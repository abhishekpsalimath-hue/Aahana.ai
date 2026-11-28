const MAX_STEPS = 30;
const STEP_TYPES = new Set(["trigger", "action", "approval"]);
const OPERATIONS = new Set([
  "capture_event",
  "assign_owner",
  "prepare_draft",
  "validate_fields",
  "collect_sample_data",
  "prepare_summary",
  "request_approval",
  "notify_owner",
]);
const APPROVAL_REQUIRED = new Set(["prepare_draft", "notify_owner"]);
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const WORKFLOW_KEYS = new Set(["id", "name", "steps"]);
const STEP_KEYS = Object.freeze({
  trigger: new Set(["id", "type", "label"]),
  action: new Set(["id", "type", "label", "operation"]),
  approval: new Set(["id", "type", "label"]),
});

function hasControlCharacters(value) {
  return typeof value === "string" && /[\u0000-\u001f\u007f]/.test(value);
}

const STEP_ANY_KEYS = new Set(["id", "type", "label", "operation"]);

function hasOnlyDataKeys(value, allowed) {
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    return Reflect.ownKeys(value).every((key) => {
      if (typeof key !== "string" || !allowed.has(key)) return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return Boolean(descriptor && Object.hasOwn(descriptor, "value"));
    });
  } catch {
    return false;
  }
}

function isPlainDataArray(value) {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
    const keys = Reflect.ownKeys(value);
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length) return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, "value")) return false;
    }
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function validateWorkflow(workflow) {
  const errors = [];
  if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) {
    return { valid: false, errors: ["Workflow must be a plain data object."] };
  }
  if (!hasOnlyDataKeys(workflow, WORKFLOW_KEYS)) {
    return { valid: false, errors: ["Workflow must contain only supported own data properties."] };
  }
  if (typeof workflow.id !== "string" || !ID_PATTERN.test(workflow.id)) {
    errors.push("Workflow id must be 1–64 safe characters.");
  }
  if (typeof workflow.name !== "string" || !workflow.name.trim() || workflow.name.length > 120 || hasControlCharacters(workflow.name)) {
    errors.push("Workflow name must contain 1–120 characters.");
  }
  if (!isPlainDataArray(workflow.steps) || workflow.steps.length < 2 || workflow.steps.length > MAX_STEPS) {
    errors.push("Workflow must contain between 2 and " + MAX_STEPS + " steps.");
    return { valid: false, errors };
  }
  const ids = new Set();
  workflow.steps.forEach((step, index) => {
    const label = "Step " + (index + 1);
    if (!step || typeof step !== "object" || Array.isArray(step) || !hasOnlyDataKeys(step, STEP_ANY_KEYS)) {
      errors.push(label + " must be a plain data object with supported own properties.");
      return;
    }
    if (!STEP_TYPES.has(step.type)) {
      errors.push(label + " has an unsupported type.");
    } else if (!hasOnlyDataKeys(step, STEP_KEYS[step.type])) {
      errors.push(label + " contains unsupported properties or accessor properties.");
      return;
    }
    if (typeof step.id !== "string" || !ID_PATTERN.test(step.id)) {
      errors.push(label + " has an invalid id.");
    } else if (ids.has(step.id)) {
      errors.push(label + " has a duplicate id.");
    } else {
      ids.add(step.id);
    }
    if (typeof step.label !== "string" || !step.label.trim() || step.label.length > 160 || hasControlCharacters(step.label)) {
      errors.push(label + " needs a label of 1–160 characters.");
    }
    if (step.type === "trigger" && index !== 0) errors.push("The trigger must be the first step.");
    if (step.type === "approval" && index !== workflow.steps.length - 1) errors.push("Approval gates must be the final step in this prototype.");
    if (step.type === "action" && !OPERATIONS.has(step.operation)) errors.push(label + " uses an unsupported operation.");
    if (step.type === "action" && APPROVAL_REQUIRED.has(step.operation) && workflow.steps.at(-1)?.type !== "approval") {
      errors.push(label + " requires a final human approval gate.");
    }
  });
  if (workflow.steps[0]?.type !== "trigger") errors.push("A workflow must start with a trigger.");
  if (workflow.steps.at(-1)?.type !== "approval") errors.push("A workflow must end with a human approval gate.");
  return { valid: errors.length === 0, errors };
}

export function createDryRunPlan(workflow) {
  const validation = validateWorkflow(workflow);
  if (!validation.valid) {
    return { ok: false, errors: validation.errors, externalSideEffects: false, steps: [] };
  }
  return {
    ok: true,
    workflowId: workflow.id,
    workflowName: workflow.name,
    externalSideEffects: false,
    steps: workflow.steps.map((step, index) => ({
      stepId: step.id,
      label: step.label,
      type: step.type,
      status: step.type === "approval" ? "awaiting-human-approval" : "simulated",
      sequence: index + 1,
    })),
  };
}

export const FLOW_LIMITS = Object.freeze({
  maxSteps: MAX_STEPS,
  operations: Object.freeze([...OPERATIONS]),
  approvalRequiredOperations: Object.freeze([...APPROVAL_REQUIRED]),
});

export function parseWorkflowExport(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
      !hasOnlyDataKeys(payload, new Set(["format", "version", "exportedAt", "workflow"]))) {
    return { valid: false, errors: ["Export file must contain only supported own data properties."], workflow: null };
  }
  if (payload.format !== "aahana-flow-workflow" || payload.version !== 1 ||
      typeof payload.exportedAt !== "string" || payload.exportedAt.length > 40 ||
      !Number.isFinite(Date.parse(payload.exportedAt)) ||
      new Date(payload.exportedAt).toISOString() !== payload.exportedAt) {
    return { valid: false, errors: ["Unsupported Aahana Flow export format, version or timestamp."], workflow: null };
  }
  const validation = validateWorkflow(payload.workflow);
  if (!validation.valid) return { valid: false, errors: validation.errors, workflow: null };
  const workflow = Object.freeze({
    id: payload.workflow.id,
    name: payload.workflow.name,
    steps: Object.freeze(payload.workflow.steps.map((step) => Object.freeze({
      id: step.id,
      type: step.type,
      label: step.label,
      ...(step.type === "action" ? { operation: step.operation } : {}),
    }))),
  });
  return { valid: true, errors: [], workflow };
}
