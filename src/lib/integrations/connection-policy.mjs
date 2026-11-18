const CONNECTION_STATES = new Set(["disconnected", "pending", "connected", "revoked", "error"]);
const PROVIDER_ID = /^[a-z0-9][a-z0-9._-]{1,63}$/;

function cleanScopes(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((scope) => typeof scope === "string" && scope.trim()).map((scope) => scope.trim()))].sort();
}

/**
 * Normalize non-secret connection metadata for the integration directory.
 * OAuth tokens, API keys and refresh tokens must remain in server-side secret
 * storage and are intentionally never accepted or returned by this policy.
 */
export function normalizeIntegrationConnection(input = {}) {
  const providerId = typeof input.providerId === "string" ? input.providerId.trim().toLowerCase() : "";
  if (!PROVIDER_ID.test(providerId)) throw new TypeError("A valid integration provider ID is required.");

  const state = CONNECTION_STATES.has(input.state) ? input.state : "disconnected";
  const requestedScopes = cleanScopes(input.requestedScopes);
  const grantedScopes = cleanScopes(input.grantedScopes);
  const missingScopes = requestedScopes.filter((scope) => !grantedScopes.includes(scope));
  const connected = state === "connected" && missingScopes.length === 0;

  return Object.freeze({
    providerId,
    state: connected ? "connected" : state === "connected" ? "pending" : state,
    accountLabel: typeof input.accountLabel === "string" ? input.accountLabel.trim().slice(0, 120) : "",
    requestedScopes,
    grantedScopes,
    missingScopes,
    connected,
    approvalRequired: true,
    externalActionsAllowed: false,
    secretStorage: "server_only",
  });
}

export function isIntegrationActionAllowed(connection, action = {}) {
  return Boolean(
    connection?.connected === true &&
    connection?.state === "connected" &&
    connection?.approvalRequired === true &&
    connection?.externalActionsAllowed === false &&
    action.freshUserApproval === true &&
    typeof action.actionId === "string" &&
    action.actionId.trim().length > 0
  );
}
