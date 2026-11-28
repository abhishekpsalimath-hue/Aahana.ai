const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const MAX_SCOPE_DAYS = 30;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export function validateAssessmentScope(scope, now = Date.now()) {
  const errors = [];
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) {
    return { valid: false, errors: ["An explicit authorization scope is required."], normalized: null };
  }
  if (scope.authorized !== true) errors.push("Confirm that you own the asset or have written permission to assess it.");
  if (typeof scope.authorizationNote !== "string" || scope.authorizationNote.trim().length < 20 || scope.authorizationNote.length > 1000) {
    errors.push("Provide an authorization note of 20–1000 characters.");
  }
  if (!Array.isArray(scope.assets) || scope.assets.length < 1 || scope.assets.length > 10) {
    errors.push("List between 1 and 10 exact hostnames.");
  }
  const assets = [];
  for (const asset of Array.isArray(scope.assets) ? scope.assets : []) {
    if (typeof asset !== "string") {
      errors.push("Every asset must be an exact hostname.");
      continue;
    }
    const host = asset.trim().toLowerCase();
    if (!HOSTNAME.test(host) || host.includes("*") || host.includes("/") || host.includes("@")) {
      errors.push("Only exact public DNS hostnames are accepted; wildcards, URLs, paths and IP addresses are not allowed.");
      continue;
    }
    if (!assets.includes(host)) assets.push(host);
  }
  if (Array.isArray(scope.assets) && assets.length !== scope.assets.length) {
    errors.push("Asset scope contains duplicate or invalid entries.");
  }
  const expiresAt = typeof scope.expiresAt === "string" ? Date.parse(scope.expiresAt) : NaN;
  if (!Number.isFinite(expiresAt) || expiresAt <= now || expiresAt > now + MAX_SCOPE_DAYS * 86400000) {
    errors.push("Authorization expiry must be in the future and within 30 days.");
  }
  return {
    valid: errors.length === 0,
    errors,
    normalized: errors.length === 0 ? {
      authorized: true,
      assets,
      expiresAt: new Date(expiresAt).toISOString(),
      authorizationNote: scope.authorizationNote.trim(),
      executionEnabled: false,
    } : null,
  };
}

export function createAssessmentRecord(scope, { assessmentId, createdAt = new Date().toISOString(), now = Date.now() } = {}) {
  const validation = validateAssessmentScope(scope, now);
  if (!validation.valid) return { ok: false, errors: validation.errors, record: null };
  if (typeof assessmentId !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(assessmentId)) {
    return { ok: false, errors: ["A safe assessment identifier is required."], record: null };
  }
  const createdTimestamp = typeof createdAt === "string" ? Date.parse(createdAt) : NaN;
  if (!Number.isFinite(createdTimestamp) || createdTimestamp > now || createdTimestamp < now - MAX_SCOPE_DAYS * 86400000) {
    return { ok: false, errors: ["Assessment creation time must be valid, non-future and within the last 30 days."], record: null };
  }
  const record = deepFreeze({
    assessmentId,
    createdAt: new Date(createdTimestamp).toISOString(),
    scope: validation.normalized,
    status: "scope-approved-awaiting-independent-review",
    networkActivity: false,
    findings: [],
  });
  return { ok: true, record };
}
