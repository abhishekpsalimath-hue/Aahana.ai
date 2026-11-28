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

test("rejects control characters in workflow names and step labels", () => {
  const badName = validWorkflow();
  badName.name = "Daily summary\nInjected heading";
  assert.equal(validateWorkflow(badName).valid, false);
  const badLabel = validWorkflow();
  badLabel.steps[1].label = "Prepare summary\u0000hidden";
  assert.equal(validateWorkflow(badLabel).valid, false);
});


test("rejects accessor properties without invoking getters", () => {
  const workflow = validWorkflow();
  let getterCalled = false;
  Object.defineProperty(workflow.steps[1], "label", {
    enumerable: true,
    get() {
      getterCalled = true;
      throw new Error("getter must not run");
    },
  });
  const result = validateWorkflow(workflow);
  assert.equal(result.valid, false);
  assert.equal(getterCalled, false);
});

test("rejects custom prototypes and symbol-keyed workflow data", () => {
  const inherited = Object.assign(Object.create({ inherited: true }), validWorkflow());
  assert.equal(validateWorkflow(inherited).valid, false);
  const symbolKeyed = validWorkflow();
  symbolKeyed[Symbol("hidden")] = "unsupported";
  assert.equal(validateWorkflow(symbolKeyed).valid, false);
});

test("accepts a null-prototype workflow made only of safe own data fields", () => {
  const source = validWorkflow();
  const workflow = Object.assign(Object.create(null), source, {
    steps: source.steps.map((step) => Object.assign(Object.create(null), step)),
  });
  assert.deepEqual(validateWorkflow(workflow), { valid: true, errors: [] });
});


test("rejects accessor-backed and sparse workflow step arrays without invoking getters", () => {
  const accessorWorkflow = validWorkflow();
  let getterCalled = false;
  Object.defineProperty(accessorWorkflow.steps, "1", {
    enumerable: true,
    configurable: true,
    get() {
      getterCalled = true;
      throw new Error("array getter must not run");
    },
  });
  assert.equal(validateWorkflow(accessorWorkflow).valid, false);
  assert.equal(getterCalled, false);

  const sparseWorkflow = validWorkflow();
  delete sparseWorkflow.steps[1];
  assert.equal(validateWorkflow(sparseWorkflow).valid, false);
});

test("rejects array subclasses and arrays with extra named properties", () => {
  const subclassWorkflow = validWorkflow();
  subclassWorkflow.steps = new (class extends Array {})(...subclassWorkflow.steps);
  assert.equal(validateWorkflow(subclassWorkflow).valid, false);

  const extraPropertyWorkflow = validWorkflow();
  extraPropertyWorkflow.steps.metadata = "not allowed";
  assert.equal(validateWorkflow(extraPropertyWorkflow).valid, false);
});


test("rejects proxy-backed workflow records without throwing", () => {
  const source = validWorkflow();
  const workflow = new Proxy(source, {
    getPrototypeOf() { throw new Error("proxy trap"); },
  });
  assert.equal(validateWorkflow(workflow).valid, false);
});

test("rejects proxy-backed step arrays without throwing", () => {
  const workflow = validWorkflow();
  workflow.steps = new Proxy(workflow.steps, {
    ownKeys() { throw new Error("proxy trap"); },
  });
  assert.equal(validateWorkflow(workflow).valid, false);
});
