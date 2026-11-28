import test from "node:test";
import assert from "node:assert/strict";
import { createDryRunPlan, validateWorkflow } from "../src/lib/flow/workflow-model.mjs";

const validWorkflow = () => ({
  id: "daily-summary",
  name: "Daily summary",
  steps: [
    { id: "start", type: "trigger", label: "Weekday schedule" },
    { id: "summary", type: "action", operation: "prepare_summary", label: "Prepare summary" },
    { id: "approve", type: "approval", label: "Review before sharing" },
  ],
});

test("accepts a well-formed workflow with an approval gate", () => {
  assert.deepEqual(validateWorkflow(validWorkflow()), { valid: true, errors: [] });
});
test("rejects workflows without a trigger at the beginning", () => {
  const workflow = validWorkflow();
  workflow.steps[0] = { id: "action", type: "action", operation: "prepare_summary", label: "Prepare" };
  assert.equal(validateWorkflow(workflow).valid, false);
});
test("rejects workflows without a final human approval gate", () => {
  const workflow = validWorkflow();
  workflow.steps.pop();
  assert.equal(validateWorkflow(workflow).valid, false);
});
test("requires approval for outbound or notification actions", () => {
  const workflow = validWorkflow();
  workflow.steps.splice(1, 1, { id: "notify", type: "action", operation: "notify_owner", label: "Notify owner" });
  workflow.steps.pop();
  const result = validateWorkflow(workflow);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("approval gate")));
});
test("rejects arbitrary or unsupported operations", () => {
  const workflow = validWorkflow();
  workflow.steps[1].operation = "run_shell_command";
  assert.equal(validateWorkflow(workflow).valid, false);
});
test("rejects unknown workflow and step properties rather than accepting executable payloads", () => {
  const workflow = validWorkflow();
  workflow.steps[1].script = "return fetch('https://example.com')";
  assert.equal(validateWorkflow(workflow).valid, false);
  const withExtraTopLevel = validWorkflow();
  withExtraTopLevel.runtime = { shell: true };
  assert.equal(validateWorkflow(withExtraTopLevel).valid, false);
});
test("rejects duplicate step identifiers", () => {
  const workflow = validWorkflow();
  workflow.steps[1].id = workflow.steps[0].id;
  assert.equal(validateWorkflow(workflow).valid, false);
});
test("rejects oversized workflows", () => {
  const workflow = validWorkflow();
  workflow.steps = Array.from({ length: 31 }, (_, index) => ({
    id: "step-" + index,
    type: index === 0 ? "trigger" : index === 30 ? "approval" : "action",
    ...(index > 0 && index < 30 ? { operation: "prepare_summary" } : {}),
    label: "Step " + index,
  }));
  assert.equal(validateWorkflow(workflow).valid, false);
});
test("dry run produces a plan without external side effects", () => {
  const plan = createDryRunPlan(validWorkflow());
  assert.equal(plan.ok, true);
  assert.equal(plan.externalSideEffects, false);
  assert.equal(plan.steps[0].status, "simulated");
  assert.equal(plan.steps.at(-1).status, "awaiting-human-approval");
});
test("dry run refuses invalid workflows", () => {
  const workflow = validWorkflow();
  workflow.steps[1].operation = "delete_database";
  const plan = createDryRunPlan(workflow);
  assert.equal(plan.ok, false);
  assert.equal(plan.steps.length, 0);
  assert.equal(plan.externalSideEffects, false);
});
