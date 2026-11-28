import { validateWorkflow } from "./workflow-model.mjs";
import { suggestWorkflowTemplate } from "./workflow-planner.mjs";

const DRAFTS = Object.freeze({
  enquiries: {
    name: "New enquiry follow-up",
    steps: [
      { id: "trigger", type: "trigger", label: "New enquiry received", explanation: "Start when a new enquiry is entered into an approved source." },
      { id: "assign-owner", type: "action", operation: "assign_owner", label: "Assign an owner", explanation: "Prepare an ownership assignment; no person is actually notified or changed in this prototype." },
      { id: "prepare-follow-up", type: "action", operation: "prepare_draft", label: "Prepare a follow-up draft", explanation: "Prepare text for a person to review. Sending is not available." },
      { id: "approval", type: "approval", label: "Human review before any follow-up", explanation: "A person must review and approve before any future external action." },
    ],
  },
  invoice: {
    name: "Invoice review",
    steps: [
      { id: "trigger", type: "trigger", label: "Invoice added for review", explanation: "Start when an invoice is supplied through an approved intake point." },
      { id: "validate-fields", type: "action", operation: "validate_fields", label: "Validate required invoice fields", explanation: "Check whether required fields are present; this prototype does not read or process a real invoice." },
      { id: "collect-sample", type: "action", operation: "collect_sample_data", label: "Prepare a sample review record", explanation: "Represent a sample record only; no file, database or finance system is accessed." },
      { id: "approval", type: "approval", label: "Human review before finance action", explanation: "A person must verify the invoice and approve any future finance action." },
    ],
  },
  daily: {
    name: "Daily business summary",
    steps: [
      { id: "trigger", type: "trigger", label: "Weekday schedule", explanation: "Represent a weekday trigger; no scheduler is activated." },
      { id: "collect-sample", type: "action", operation: "collect_sample_data", label: "Collect approved source data", explanation: "Describe a future data-collection step; no connected source is accessed." },
      { id: "prepare-summary", type: "action", operation: "prepare_summary", label: "Prepare the business summary", explanation: "Prepare a summary from approved inputs in a future connected version; no report is generated from live data." },
      { id: "approval", type: "approval", label: "Review before sharing", explanation: "A person must review and approve before a report can be shared." },
    ],
  },
});

export function createWorkflowDraft(request) {
  if (typeof request !== "string" || !request.trim() || request.length > 500) {
    return { ok: false, reason: "Enter a request of 1–500 characters.", workflow: null, explanations: [] };
  }
  const safeRequest = request.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  const suggestion = suggestWorkflowTemplate(safeRequest);
  if (!suggestion.matched) {
    return { ok: false, reason: suggestion.reason, workflow: null, explanations: [] };
  }
  const definition = DRAFTS[suggestion.templateId];
  if (!definition) {
    return { ok: false, reason: "No safe starter is available for this request.", workflow: null, explanations: [] };
  }
  const workflow = {
    id: suggestion.templateId,
    name: definition.name,
    steps: definition.steps.map(({ explanation, ...step }) => ({ ...step })),
  };
  const validation = validateWorkflow(workflow);
  if (!validation.valid) {
    return { ok: false, reason: "The suggested starter did not pass workflow validation.", errors: validation.errors, workflow: null, explanations: [] };
  }
  return {
    ok: true,
    planner: "keyword-assisted-v1",
    requestSummary: safeRequest,
    confidence: suggestion.confidence,
    workflow,
    explanations: definition.steps.map(({ id, label, explanation }, index) => ({
      stepId: id,
      sequence: index + 1,
      label,
      explanation,
    })),
    validation: { valid: true, errors: [] },
    externalSideEffects: false,
    executionEnabled: false,
  };
}
