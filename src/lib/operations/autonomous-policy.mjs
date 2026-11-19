const MAX_FILES = 20;
const MAX_PATCH_BYTES = 30_000;
const MAX_TOTAL_CHANGES = 500;

const BLOCKED_PATHS = [
  /^\.github\//i,
  /(^|\/)\.env(?:\.|$)/i,
  /(^|\/)(?:secrets?|credentials?)(?:\/|\.|$)/i,
  /(^|\/)(?:migrations?|supabase\/migrations)(?:\/|$)/i,
  /(^|\/)(?:auth|billing|payments?|privacy|security)(?:\/|$)/i,
  /(?:^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/i,
];

const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:ghp|github_pat|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\b(?:SUPABASE_SERVICE_ROLE_KEY|VERCEL_TOKEN|CRON_SECRET)\s*[:=]\s*["']?[^\s"']{8,}/i,
];

// This is a policy evaluator, not an evidence authenticator. Call it only after
// a trusted server-side orchestrator has independently collected the diff and
// test results; never accept caller/model-supplied evidence as authorization.
function normalizePath(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const path = value.normalize("NFC");
  if (/[%\u0000-\u001f\u007f\u2044\u2215\uff0f]/u.test(path)) return null;
  if (path.includes(":")) return null;
  const slashPath = path.replaceAll("\\", "/");
  if (slashPath.startsWith("/") || /^[A-Za-z]:/.test(slashPath)) return null;
  const segments = slashPath.split("/");
  if (segments.some((part) => !part || part === "." || part === "..")) return null;
  return segments.join("/");
}

function normalizeAllowlistPattern(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const recursive = value.endsWith("/**");
  const rawPath = recursive ? value.slice(0, -3) : value;
  const path = normalizePath(rawPath);
  if (!path || rawPath.includes("*")) return null;
  return recursive ? { path: path.toLowerCase(), recursive: true } : { path: path.toLowerCase(), recursive: false };
}

function isAllowed(path, allowedPaths) {
  const candidate = path.toLowerCase();
  return allowedPaths.some((pattern) => {
    const normalized = normalizeAllowlistPattern(pattern);
    if (!normalized) return false;
    return normalized.recursive ? candidate.startsWith(normalized.path + "/") : candidate === normalized.path;
  });
}

export function evaluateAutonomousTask(task, evidence = {}) {
  const errors = [];
  if (!task || typeof task !== "object" || Array.isArray(task)) {
    return { ok: false, errors: ["task must be an object"] };
  }
  if (!/^[a-f0-9]{40}$/i.test(task.sourceSha || "")) errors.push("sourceSha must be a full immutable commit SHA");
  if (task.risk !== "low") errors.push("only explicitly low-risk tasks are eligible");
  if (!Array.isArray(task.allowedPaths) || task.allowedPaths.length === 0) errors.push("allowedPaths must be a non-empty array");
  if (!Array.isArray(evidence.changedFiles)) errors.push("changedFiles evidence is required");

  const allowedPaths = Array.isArray(task.allowedPaths) ? task.allowedPaths : [];
  const changedFiles = Array.isArray(evidence.changedFiles) ? evidence.changedFiles : [];
  if (changedFiles.length > MAX_FILES) errors.push("changed file count exceeds policy limit");

  for (const entry of changedFiles) {
    if (entry?.type === "symlink" || entry?.mode === "120000" || entry?.symlink === true) {
      errors.push("symbolic links cannot be changed autonomously");
      continue;
    }
    const path = normalizePath(entry?.path);
    if (!path) {
      errors.push("changed file contains an invalid or traversing path");
      continue;
    }
    if (!isAllowed(path, allowedPaths)) errors.push(`path is outside the task allowlist: ${path}`);
    if (BLOCKED_PATHS.some((pattern) => pattern.test(path))) errors.push(`protected path cannot be changed autonomously: ${path}`);
  }

  const patch = typeof evidence.patch === "string" ? evidence.patch : "";
  if (new TextEncoder().encode(patch).length > MAX_PATCH_BYTES) errors.push("patch exceeds byte limit");
  const additions = Number(evidence.additions);
  const deletions = Number(evidence.deletions);
  if (!Number.isInteger(additions) || additions < 0 || !Number.isInteger(deletions) || deletions < 0 || additions + deletions > MAX_TOTAL_CHANGES) {
    errors.push("total additions and deletions exceed policy limit or are invalid");
  }
  if (SECRET_PATTERNS.some((pattern) => pattern.test(patch))) errors.push("patch contains a potential secret");
  if (!Array.isArray(evidence.tests) || evidence.tests.length === 0) {
    errors.push("test evidence is required");
  } else if (evidence.tests.some((test) => !test || typeof test.command !== "string" || !test.command.trim() || test.exitCode !== 0)) {
    errors.push("every required test command must have a recorded zero exit code");
  }
  if (!Array.isArray(evidence.acceptanceCriteria) || evidence.acceptanceCriteria.length === 0) {
    errors.push("acceptance criteria evidence is required");
  } else if (evidence.acceptanceCriteria.some((item) => !item || item.met !== true || typeof item.evidence !== "string" || !item.evidence.trim())) {
    errors.push("every acceptance criterion must be met and linked to evidence");
  }
  return { ok: errors.length === 0, errors };
}

export const AUTONOMOUS_POLICY_LIMITS = Object.freeze({
  maxFiles: MAX_FILES,
  maxPatchBytes: MAX_PATCH_BYTES,
  maxTotalChanges: MAX_TOTAL_CHANGES,
});
