import test from "node:test";
import assert from "node:assert/strict";
import { getAgentRequestTimeoutMs, MAX_AGENT_RUNTIME_MS, MAX_AGENT_REQUEST_TIMEOUT_MS } from "./runtime-budget.mjs";

test("caps a model request at twelve seconds while preserving the total runtime budget", () => {
  const started = 1_000;
  assert.equal(getAgentRequestTimeoutMs(started, started), MAX_AGENT_REQUEST_TIMEOUT_MS);
  assert.equal(getAgentRequestTimeoutMs(started, started + 35_000), 7_000);
  assert.equal(getAgentRequestTimeoutMs(started, started + MAX_AGENT_RUNTIME_MS), 0);
});

test("fails closed for invalid or reversed timestamps", () => {
  assert.equal(getAgentRequestTimeoutMs(Number.NaN, 1_000), 0);
  assert.equal(getAgentRequestTimeoutMs(2_000, 1_000), 0);
});