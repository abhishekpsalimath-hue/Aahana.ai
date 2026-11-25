export const MAX_AGENT_RUNTIME_MS = 42_000;
export const MAX_AGENT_REQUEST_TIMEOUT_MS = 12_000;

export function getAgentRequestTimeoutMs(startedAt, now = Date.now()) {
  if (!Number.isFinite(startedAt) || !Number.isFinite(now) || startedAt < 0 || now < startedAt) return 0;
  const remaining = MAX_AGENT_RUNTIME_MS - (now - startedAt);
  return remaining > 0 ? Math.min(MAX_AGENT_REQUEST_TIMEOUT_MS, remaining) : 0;
}
