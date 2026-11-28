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

function hasOnlyKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.has(key));
}

export function validateWorkflow(workflow) {
  const errors = [];
  if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) {
    return { valid: false, errors: ["Workflow must be an object."] };
  }
  if (!hasOnlyKeys(workflow, WORKFLOW_KEYS)) errors.push("Workflow contains unsupported properties.");
  if (typeof workflow.id !== "string" || !ID_PATTERN.test(workflow.id)) {
    errors.push("Workflow id must be 1–64 safe characters.");
  }
  if (typeof workflow.name !== "string" || !workflow.name.trim() || workflow.name.length > 120) {
    errors.push("Workflow name must contain 1–120 characters.");
  }
  if (!Array.isArray(workflow.steps) || workflow.steps.length < 2 || workflow.steps.length > MAX_STEPS) {
    errors.push(\`Workflow must contain between 2 and \${MAX_STEPS} steps.\`);
    return { valid: false, errors };
  }
  const ids = new Set();
  workflow.steps.forEach((step, index) => {
    const label = \`Step \${index + 1}\`;
    if (!step || typeof step !== "object" || Array.isArray(step)) {
      errors.push(\`\${label} must be an object.\`);
      return;
    }
    if (!STEP_TYPES.has(step.type)) {
      errors.push(\`\${label} has an unsupported type.\`);
    } else if (!hasOnlyKeys(step, STEP_KEYS[step.type])) {
      errors.push(\`\${label} contains unsupported properties.\`);
    }
    if (typeof step.id !== "string" || !ID_PATTERN.test(step.id)) {
      errors.push(\`\${label} has an invalid id.\`);
    } else if (ids.has(step.id)) {
      errors.push(\`\${label} has a duplicate id.\`);
    } else {
      ids.add(step.id);
    }
    if (typeof step.label !== "string" || !step.label.trim() || step.label.length > 160) {
      errors.push(\`\${label} needs a label of 1–160 characters.\`);
    }
    if (step.type === "trigger" && index !== 0) errors.push("The trigger must be the first step.");
    if (step.type === "approval" && index !== workflow.steps.length - 1) errors.push("Approval gates must be the final step in this prototype.");
    if (step.type === "action" && !OPERATIONS.has(step.operation)) errors.push(\`\${label} uses an unsupported operation.\`);
    if (step.type === "action" && APPROVAL_REQUIRED.has(step.operation) && workflow.steps.at(-1)?.type !== "approval") {
      errors.push(\`\${label} requires a final human approval gate.\`);
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
