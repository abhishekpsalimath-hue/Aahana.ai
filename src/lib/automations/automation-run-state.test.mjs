import test from "node:test";
import assert from "node:assert/strict";
import {
  canReadAutomationRun,
  getAutomationRetryDelayMs,
  transitionAutomationRun,
} from "./automation-run-state.mjs";

test("allows only explicit forward transitions and terminal states stay terminal", () => {
  assert.deepEqual(transitionAutomationRun("queued", "running"), { ok: true, state: "running", nextAttempt: 1 });
  assert.equal(transitionAutomationRun("running", "queued").error, "transition_not_allowed");
  assert.equal(transitionAutomationRun("succeeded", "queued").error, "transition_not_allowed");
  assert.equal(transitionAutomationRun("queued", "needs_approval").state, "needs_approval");
});

test("enforces retry limits and increments the attempt only on a retry", () => {
  assert.deepEqual(transitionAutomationRun("failed", "queued", { attempt: 1, maxAttempts: 3 }), {
    ok: true, state: "queued", nextAttempt: 2,
  });
  assert.equal(transitionAutomationRun("failed", "queued", { attempt: 3, maxAttempts: 3 }).error, "retry_limit_reached");
  assert.equal(transitionAutomationRun("running", "failed", { attempt: 2, maxAttempts: 3 }).nextAttempt, 2);
});

test("uses capped exponential retry delays and rejects invalid values", () => {
  assert.equal(getAutomationRetryDelayMs(1), 30_000);
  assert.equal(getAutomationRetryDelayMs(3), 120_000);
  assert.equal(getAutomationRetryDelayMs(20), 60 * 60_000);
  assert.equal(getAutomationRetryDelayMs(0), null);
});

test("scopes run visibility to its exact owner", () => {
  const run = { id: "run-1", userId: "user-a" };
  assert.equal(canReadAutomationRun(run, "user-a"), true);
  assert.equal(canReadAutomationRun(run, "user-b"), false);
  assert.equal(canReadAutomationRun(run, ""), false);
});
