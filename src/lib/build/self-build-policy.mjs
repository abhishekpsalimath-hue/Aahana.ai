const MAX_FILES = 20;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;
const SHA_PATTERN = /^[a-f0-9]{40}$/i;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

// Student Mode, authentication, database, and deployment code are intentionally excluded.
const ALLOWED_FILES = new Set(["src/app/assistant-workspace.jsx"]);
const ALLOWED_ROOTS = [
  "src/app/experience-lab/",
  "src/app/assistant-workspace.jsx",
  "src/lib/build/",
];

const BLOCKED_SEGMENTS = new Set([
  "student", "students", "student-mode", "auth", "login", "signup",
  "supabase", "migrations", "middleware", "secrets", "credentials",
]);

const BLOCKED_FILES = new Set([
  "self-build-policy.mjs", "sandbox-policy.mjs", "github-app.mjs",
  "build-engine.mjs", "source-file-policy.mjs",
]);

const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
];

export function getSelfBuildConfig(env = process.env) {
  const repository = String(env.AAHANA_SELF_BUILD_REPOSITORY || "").trim();
  const allowedEmails = String(env.AAHANA_SELF_BUILD_ALLOWED_EMAILS || "")
    .split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  const required = [
    "AAHANA_GITHUB_APP_ID",
    "AAHANA_GITHUB_INSTALLATION_ID",
    "AAHANA_GITHUB_PRIVATE_KEY",
    "AAHANA_SELF_BUILD_REPOSITORY",
    "AAHANA_SELF_BUILD_ALLOWED_EMAILS",
  ];
  const missing = required.filter((key) => !String(env[key] || "").trim());
  if (!/^\d+$/.test(String(env.AAHANA_GITHUB_APP_ID || "")) && !missing.includes("AAHANA_GITHUB_APP_ID")) missing.push("AAHANA_GITHUB_APP_ID");
  if (!/^\d+$/.test(String(env.AAHANA_GITHUB_INSTALLATION_ID || "")) && !missing.includes("AAHANA_GITHUB_INSTALLATION_ID")) missing.push("AAHANA_GITHUB_INSTALLATION_ID");
  const validRepository = REPOSITORY_PATTERN.test(repository) &&
    repository.split("/").every((part) => part !== "." && part !== "..");
  return Object.freeze({
    enabled: missing.length === 0 && validRepository && allowedEmails.length > 0,
    missing,
    repository: validRepository ? repository : null,
    allowedEmails: Object.freeze(allowedEmails),
  });
}

export function isSelfBuildOwner(email, config) {
  return typeof email === "string" && Boolean(config?.enabled) &&
    config.allowedEmails.includes(email.trim().toLowerCase());
}

export function isAllowedSelfBuildPath(input) {
  if (typeof input !== "string" || input.length < 1 || input.length > 240 ||
      input.startsWith("/") || input.includes("\\") || input.includes("%") ||
      /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(input)) return false;

  const segments = input.split("/");
  if (segments.some((segment) =>
    !segment || segment === "." || segment === ".." ||
    segment.startsWith(".") ||
    BLOCKED_SEGMENTS.has(segment.toLowerCase()) || segment.toLowerCase().includes("student") ||
    /^(?:\.env|package(?:-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$/i.test(segment)
  )) return false;

  if (BLOCKED_FILES.has(segments.at(-1).toLowerCase())) return false;
  return ALLOWED_FILES.has(input) || (ALLOWED_ROOTS.some((root) => input.startsWith(root)) &&
    /\.(?:js|jsx|mjs|cjs|ts|tsx|css|scss|json|md)$/i.test(input));
}

export function validateSelfBuildChangeSet({ baseSha, files }) {
  if (typeof baseSha !== "string" || !SHA_PATTERN.test(baseSha)) {
    throw new Error("A valid base commit is required before proposing repository changes.");
  }
  if (!Array.isArray(files) || files.length < 1 || files.length > MAX_FILES) {
    throw new Error("A self-build change must contain 1–20 files.");
  }

  const seen = new Set();
  let totalBytes = 0;
  const validated = files.map((file) => {
    if (!isAllowedSelfBuildPath(file?.path)) {
      throw new Error("This repository path is outside Aahana's approved self-build scope.");
    }
    if (seen.has(file.path)) throw new Error("A self-build change cannot contain duplicate paths.");
    seen.add(file.path);
    if (typeof file.content !== "string" || file.content.includes("\u0000")) {
      throw new Error("Repository changes must contain valid text source.");
    }
    const bytes = new TextEncoder().encode(file.content).byteLength;
    if (bytes < 1 || bytes > MAX_FILE_BYTES) throw new Error("Each self-build file must be 1 byte to 1 MB.");
    if (SECRET_PATTERNS.some((pattern) => pattern.test(file.content))) {
      throw new Error("A possible credential was detected. Remove secrets before proposing repository changes.");
    }
    totalBytes += bytes;
    if (totalBytes > MAX_TOTAL_BYTES) throw new Error("A self-build change cannot exceed 2 MB.");
    return Object.freeze({ path: file.path, content: file.content, bytes });
  });

  return Object.freeze({ baseSha: baseSha.toLowerCase(), files: Object.freeze(validated) });
}
