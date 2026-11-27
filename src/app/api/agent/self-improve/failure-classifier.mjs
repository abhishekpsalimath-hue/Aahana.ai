const RULES = [
  { code: "RUNTIME_BUDGET", pattern: /runtime safety budget|timed? ?out|timeout|aborted/i, retryable: true, recovery: "RESTART_WITH_A_SMALLER_TASK" },
  { code: "UPSTREAM_UNAVAILABLE", pattern: /network|fetch failed|econnreset|temporarily unavailable|\b429\b|\b5\d\d\b/i, retryable: true, recovery: "RETRY_AFTER_BACKOFF" },
  { code: "PATCH_NOT_UNIQUE", pattern: /match exactly once|more specific/i, retryable: false, recovery: "READ_CURRENT_SOURCE_AND_REFINE_PATCH" },
  { code: "STALE_SOURCE", pattern: /exact source file version|repository changed|base version|base sha/i, retryable: false, recovery: "REFRESH_PLAN_AND_SOURCE" },
  { code: "SCOPE_VIOLATION", pattern: /outside.*scope|outside.*plan|not in the approved|not available/i, retryable: false, recovery: "REPLAN_WITH_APPROVED_PATHS" },
  { code: "CONTEXT_LIMIT", pattern: /context limit|120 KB|180 KB|at most three distinct files|at most three files/i, retryable: false, recovery: "REDUCE_FILES_AND_CONTEXT" },
  { code: "INVALID_INPUT", pattern: /invalid|incomplete|exceeds its limits|must contain|requires a concise/i, retryable: false, recovery: "CORRECT_TOOL_ARGUMENTS" },
];

export function classifySelfBuildToolFailure(message) {
  const safeMessage = typeof message === "string" ? message.slice(0, 1000) : "";
  const rule = RULES.find((item) => item.pattern.test(safeMessage));
  return Object.freeze({
    code: rule?.code || "TOOL_EXECUTION_FAILED",
    retryable: rule?.retryable === true,
    recoveryAction: rule?.recovery || "INSPECT_FAILURE_AND_REPLAN",
  });
}

export function summarizeSelfBuildFailures(failures) {
  if (!Array.isArray(failures)) throw new TypeError("Failures must be an array.");
  return Object.freeze(failures.slice(0, 8).map((failure) => {
    if (!failure || typeof failure !== "object" || typeof failure.tool !== "string" || typeof failure.message !== "string") {
      throw new TypeError("Each failure requires a tool and message.");
    }
    return Object.freeze({ tool: failure.tool, ...classifySelfBuildToolFailure(failure.message) });
  }));
}
