const VALID_PHASES = new Set(["plan", "execute"]);

export function buildSelfImproveExecutionOutcome({
  phase,
  planReady = false,
  proposalCount = 0,
  successfulToolCalls = 0,
  failedToolCalls = 0,
  finalResponse = "",
  roundsUsed = 0,
  roundLimitReached = false,
}) {
  if (!VALID_PHASES.has(phase)) throw new TypeError("Invalid self-improvement phase.");
  for (const value of [proposalCount, successfulToolCalls, failedToolCalls, roundsUsed]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new TypeError("Execution counters must be non-negative safe integers.");
  }
  if (typeof finalResponse !== "string") throw new TypeError("Final response must be a string.");

  let status;
  let reasonCode;
  if (phase === "plan") {
    status = planReady ? "plan_ready" : failedToolCalls ? "blocked" : "failed";
    reasonCode = planReady ? "PLAN_RECORDED" : failedToolCalls ? "PLAN_TOOL_FAILED" : "PLAN_NOT_RECORDED";
  } else if (proposalCount > 0 && failedToolCalls > 0) {
    status = "partial";
    reasonCode = "PROPOSAL_WITH_TOOL_ERRORS";
  } else if (proposalCount > 0) {
    status = "proposal_ready";
    reasonCode = "PROPOSAL_STAGED_FOR_REVIEW";
  } else if (failedToolCalls > 0) {
    status = "blocked";
    reasonCode = "EXECUTION_TOOL_FAILED";
  } else if (roundLimitReached || !finalResponse.trim()) {
    status = "failed";
    reasonCode = roundLimitReached ? "ROUND_LIMIT_REACHED" : "NO_FINAL_RESPONSE";
  } else {
    status = "completed";
    reasonCode = "NO_SOURCE_CHANGE_PROPOSED";
  }

  return Object.freeze({
    status,
    reasonCode,
    successfulToolCalls,
    failedToolCalls,
    proposalsStaged: proposalCount,
    roundsUsed,
    acceptanceChecks: Object.freeze({ status: "not_run", passed: 0, total: null }),
    completionClaim: status === "completed" ? "agent_turn_finished_no_change_proposed" : "not_claimed",
  });
}
