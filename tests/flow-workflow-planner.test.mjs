import test from "node:test";
import assert from "node:assert/strict";
import { suggestWorkflowTemplate } from "../src/lib/flow/workflow-planner.mjs";

test("suggests invoice review for invoice language", () => {
  assert.equal(suggestWorkflowTemplate("Review supplier invoices every week").templateId, "invoice");
});
test("suggests enquiry follow-up for lead language", () => {
  assert.equal(suggestWorkflowTemplate("Assign each new lead to a sales owner").templateId, "enquiries");
});
test("suggests daily summary for explicit daily reporting language", () => {
  assert.equal(suggestWorkflowTemplate("Prepare a daily business summary").templateId, "daily");
});
test("does not overmatch a keyword embedded inside another word", () => {
  assert.equal(suggestWorkflowTemplate("Set up billing reminders").matched, false);
});
test("does not map an unspecified report cadence to a weekday schedule", () => {
  assert.equal(suggestWorkflowTemplate("Prepare a weekly report").matched, false);
});
test("does not guess when there is no recognizable intent", () => {
  assert.equal(suggestWorkflowTemplate("Make my company better").matched, false);
});
test("does not guess when two templates tie", () => {
  assert.equal(suggestWorkflowTemplate("daily invoice summary").matched, false);
});
test("handles empty and non-string requests", () => {
  assert.equal(suggestWorkflowTemplate("").matched, false);
  assert.equal(suggestWorkflowTemplate(null).matched, false);
});
