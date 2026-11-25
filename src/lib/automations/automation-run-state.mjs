export const AUTOMATION_RUN_STATES = Object.freeze([
  "queued",
  "running",
  "needs_approval",
  "succeeded",
  "failed",
  "cancelled",
]);

const TRANSITIONS = Object.freeze({
  queued: new Set(["running", "needs_approval", "cancelled"]),
  running: new Set(["succeeded", "failed", "cancelled"]),
  needs_approval: new Set(["queued", "cancelled"]),
  failed: new Set(["queued", "cancelled"]),
  succeeded: new Set(),
  cancelled: new Set(),
});

export function transitionAutomationRun(current, next, { attempt = 1, maxAttempts = 3 } = {}) {
  if (!AUTOMATION_RUN_STATES.includes(current) || !AUTOMATION_RUN_STATES.includes(next)) {
    return { ok: false, error: "unknown_state" };
  }
  if (!TRANSITIONS[current].has(next)) return { ok: false, error: "transition_not_allowed" };
  if (!Number.isInteger(attempt) || !Number.isInteger(maxAttempts) || attempt < 1 || maxAttempts < 1) {
    return { ok: false, error: "invalid_attempt_count" };
  }
  if (current === "failed" && next === "queued" && attempt >= maxAttempts) {
    return { ok: false, error: "retry_limit_reached" };
  }
  return { ok: true, state: next, nextAttempt: current === "failed" && next === "queued" ? attempt + 1 : attempt };
}

export function getAutomationRetryDelayMs(attempt, { baseDelayMs = 30_000, maxDelayMs = 60 * 60_000 } = {}) {
  if (!Number.isInteger(attempt) || attempt < 1 ||
      !Number.isFinite(baseDelayMs) || baseDelayMs < 1 ||
      !Number.isFinite(maxDelayMs) || maxDelayMs < baseDelayMs) return null;
  return Math.min(baseDelayMs * (2 ** (attempt - 1)), maxDelayMs);
}

export function canReadAutomationRun(run, userId) {
  return Boolean(run && typeof run === "object" && typeof userId === "string" &&
    userId.length > 0 && run.userId === userId);
}
