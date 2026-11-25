import test from "node:test";
import assert from "node:assert/strict";
import { buildSelfImproveExecutionOutcome } from "./execution-outcome.mjs";

const base = { phase: "execute", finalResponse: "No safe source change is justified.", roundsUsed: 2 };

test("reports a staged proposal without claiming acceptance checks ran", () => {
  const result = buildSelfImproveExecutionOutcome({ ...base, proposalCount: 1, successfulToolCalls: 3 });
  assert.equal(result.status, "proposal_ready");
  assert.equal(result.reasonCode, "PROPOSAL_STAGED_FOR_REVIEW");
  assert.deepEqual(result.acceptanceChecks, { status: "not_run", passed: 0, total: null });
});

test("reports partial when a proposal exists alongside tool failures", () => {
  const result = buildSelfImproveExecutionOutcome({ ...base, proposalCount: 1, failedToolCalls: 1 });
  assert.equal(result.status, "partial");
  assert.equal(result.reasonCode, "PROPOSAL_WITH_TOOL_ERRORS");
});

test("reports blocked when execution tools fail without a proposal", () => {
  const result = buildSelfImproveExecutionOutcome({ ...base, failedToolCalls: 2 });
  assert.equal(result.status, "blocked");
  assert.equal(result.reasonCode, "EXECUTION_TOOL_FAILED");
});

test("does not call an empty or round-limited execution completed", () => {
  assert.equal(buildSelfImproveExecutionOutcome({ ...base, finalResponse: "" }).status, "failed");
  assert.equal(buildSelfImproveExecutionOutcome({ ...base, roundLimitReached: true }).status, "failed");
});

test("allows a truthful no-change completion", () => {
  const result = buildSelfImproveExecutionOutcome({ ...base, successfulToolCalls: 2 });
  assert.equal(result.status, "completed");
  assert.equal(result.completionClaim, "agent_turn_finished_no_change_proposed");
});

test("keeps planning outcomes distinct and validates counters", () => {
  assert.equal(buildSelfImproveExecutionOutcome({ phase: "plan", planReady: true }).status, "plan_ready");
  assert.equal(buildSelfImproveExecutionOutcome({ phase: "plan", failedToolCalls: 1 }).status, "blocked");
  assert.throws(() => buildSelfImproveExecutionOutcome({ ...base, failedToolCalls: -1 }), /counters/);
  assert.throws(() => buildSelfImproveExecutionOutcome({ ...base, phase: "other" }), /phase/);
});
