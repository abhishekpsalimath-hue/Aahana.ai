import test from "node:test";
import assert from "node:assert/strict";
import { createWorkflowDraft } from "../src/lib/flow/workflow-draft.mjs";

test("creates a validated enquiry workflow with a final human gate", () => {
  const result = createWorkflowDraft("Assign each new lead and prepare a customer follow up");
  assert.equal(result.ok, true);
  assert.equal(result.workflow.id, "enquiries");
  assert.equal(result.workflow.steps.at(-1).type, "approval");
  assert.equal(result.validation.valid, true);
});

test("creates a validated invoice workflow with an explanation for every step", () => {
  const result = createWorkflowDraft("Review supplier invoices");
  assert.equal(result.ok, true);
  assert.equal(result.explanations.length, result.workflow.steps.length);
  assert.ok(result.explanations.every((step) => step.explanation.length > 20));
});

test("creates a scheduled summary draft without activating a scheduler", () => {
  const result = createWorkflowDraft("Prepare a daily business summary");
  assert.equal(result.ok, true);
  assert.equal(result.workflow.id, "daily");
  assert.equal(result.executionEnabled, false);
  assert.equal(result.externalSideEffects, false);
});

test("does not invent a workflow for ambiguous requests", () => {
  const result = createWorkflowDraft("Make my company better");
  assert.equal(result.ok, false);
  assert.equal(result.workflow, null);
});

test("rejects empty, non-string and oversized requests", () => {
  for (const request of ["", null, 42, "x".repeat(501)]) {
    assert.equal(createWorkflowDraft(request).ok, false);
  }
});

test("does not preserve control characters in the request summary", () => {
  const result = createWorkflowDraft("Prepare a daily\\n business summary");
  assert.equal(result.ok, true);
  assert.equal(result.requestSummary.includes("\\n"), false);
});
