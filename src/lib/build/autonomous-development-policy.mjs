const MAX_TASK_PATHS = 40;
const MAX_CRITERIA = 20;
const MAX_CHANGED_FILES = 50;
const MAX_FILE_PATCH_BYTES = 30 * 1024;
const MAX_TOTAL_PATCH_BYTES = 150 * 1024;

const PROTECTED_PATHS = [
  ".git/",
  ".github/",
  ".vercel/",
  ".next/",
  "node_modules/",
  "coverage/",
  "dist/",
  "build/",
  "vercel.json",
  "package.json",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  ".npmrc",
  ".pypirc",
  "supabase/migrations/",
  "src/app/api/auth/",
  "src/lib/auth/",
  "src/lib/security/",
  "src/lib/billing/",
  "src/lib/payments/",
  "src/lib/secrets/",
  "middleware.",
  "next.config.",
];

const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  /\bsk-[A-Za-z0-9]{24,}\b/,
  /\b(api[_-]?key|client[_-]?secret|access[_-]?token|password)\s*[:=]\s*["'][^"'\s]{16,}["']/i,
];

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(label + " must be a plain object.");
  }
}

function normalizeRelativePath(value, label = "Path") {
  if (typeof value !== "string" || value.length < 1 || value.length > 240 ||
      value.startsWith("/") || value.includes("\\") ||
      /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(value)) {
    throw new Error(label + " must be a relative POSIX path.");
  }
  const isDirectory = value.endsWith("/");
  const path = isDirectory ? value.slice(0, -1) : value;
  const segments = path.split("/");
  if (!path || segments.some((part) => !part || part === "." || part === "..")) {
    throw new Error(label + " contains an unsafe path segment.");
  }
  return path + (isDirectory ? "/" : "");
}

function isProtectedPath(path) {
  const lower = path.toLowerCase();
  return PROTECTED_PATHS.some((item) => {
    const protectedPath = item.toLowerCase();
    return protectedPath.endsWith("/")
      ? lower.startsWith(protectedPath)
      : lower === protectedPath || (protectedPath.endsWith(".") && lower.startsWith(protectedPath));
  }) || lower === ".env" || lower.startsWith(".env.");
}

function isWithinAllowedPath(path, allowedPaths) {
  return allowedPaths.some((allowed) =>
    allowed.endsWith("/") ? path.startsWith(allowed) : path === allowed
  );
}

export function validateAutonomousTask(input) {
  assertPlainObject(input, "Autonomous task");
  const taskId = input.taskId;
  const repository = input.repository;
  const baseBranch = input.baseBranch;

  if (typeof taskId !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(taskId)) {
    throw new Error("Task ID is invalid.");
  }
  if (typeof repository !== "string" ||
      !/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(repository)) {
    throw new Error("Repository must use owner/repository format.");
  }
  if (typeof baseBranch !== "string" || baseBranch.length > 120 ||
      !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(baseBranch) ||
      baseBranch.includes("..") || baseBranch.endsWith("/") || baseBranch.includes("//")) {
    throw new Error("Base branch is invalid.");
  }
  if (!Array.isArray(input.allowedPaths) || input.allowedPaths.length < 1 ||
      input.allowedPaths.length > MAX_TASK_PATHS) {
    throw new Error("A task must define 1–40 allowed paths.");
  }

  const allowedPaths = input.allowedPaths.map((item) => normalizeRelativePath(item, "Allowed path"));
  if (new Set(allowedPaths).size !== allowedPaths.length) {
    throw new Error("Allowed paths must be unique.");
  }
  if (allowedPaths.some(isProtectedPath)) {
    throw new Error("Tasks cannot pre-authorise protected configuration, dependency, migration, auth, security or payment paths.");
  }
  if (!Array.isArray(input.acceptanceCriteria) || input.acceptanceCriteria.length < 1 ||
      input.acceptanceCriteria.length > MAX_CRITERIA ||
      input.acceptanceCriteria.some((item) => typeof item !== "string" || !item.trim() || item.length > 500)) {
    throw new Error("A task must define 1–20 concise acceptance criteria.");
  }

  return Object.freeze({
    taskId,
    repository,
    baseBranch,
    allowedPaths: Object.freeze(allowedPaths),
    acceptanceCriteria: Object.freeze(input.acceptanceCriteria.map((item) => item.trim())),
  });
}

/**
 * Evidence must be assembled by the server from actual sandbox process results.
 * Never pass model-authored claims or repository text as execution evidence.
 */
export function evaluateAutonomousDiff({ task: taskInput, files, evidence }) {
  const task = validateAutonomousTask(taskInput);
  if (!Array.isArray(files) || files.length < 1 || files.length > MAX_CHANGED_FILES) {
    return Object.freeze({ status: "rejected", reasons: Object.freeze(["changed_file_count_out_of_bounds"]) });
  }
  if (!Array.isArray(evidence) || evidence.length < 1 ||
      evidence.some((item) => !item || typeof item.command !== "string" ||
        !item.command.trim() || item.command.length > 200 ||
        !Number.isInteger(item.exitCode) || item.exitCode !== 0)) {
    return Object.freeze({ status: "rejected", reasons: Object.freeze(["successful_server_recorded_test_evidence_required"]) });
  }

  const reasons = [];
  let totalBytes = 0;
  for (const file of files) {
    if (!file || typeof file !== "object" || Array.isArray(file)) {
      return Object.freeze({ status: "rejected", reasons: Object.freeze(["invalid_diff_file_record"]) });
    }
    let path;
    try {
      path = normalizeRelativePath(file.path, "Changed path");
    } catch {
      return Object.freeze({ status: "rejected", reasons: Object.freeze(["unsafe_changed_path"]) });
    }
    if (!isWithinAllowedPath(path, task.allowedPaths)) {
      return Object.freeze({ status: "rejected", reasons: Object.freeze(["changed_path_outside_task_allowlist"]) });
    }
    if (typeof file.patch !== "string") {
      return Object.freeze({ status: "rejected", reasons: Object.freeze(["diff_patch_must_be_text"]) });
    }
    const bytes = new TextEncoder().encode(file.patch).byteLength;
    if (bytes > MAX_FILE_PATCH_BYTES) {
      return Object.freeze({ status: "rejected", reasons: Object.freeze(["per_file_patch_limit_exceeded"]) });
    }
    totalBytes += bytes;
    if (totalBytes > MAX_TOTAL_PATCH_BYTES) {
      return Object.freeze({ status: "rejected", reasons: Object.freeze(["total_patch_limit_exceeded"]) });
    }
    if (containsSecret(file.patch)) {
      return Object.freeze({ status: "rejected", reasons: Object.freeze(["possible_secret_in_diff"]) });
    }
    if (isProtectedPath(path)) reasons.push("protected_path_requires_owner_approval");
    if (file.changeType === "deleted" || file.changeType === "renamed") {
      reasons.push("delete_or_rename_requires_owner_approval");
    } else if (!["added", "modified"].includes(file.changeType)) {
      return Object.freeze({ status: "rejected", reasons: Object.freeze(["unsupported_change_type"]) });
    }
  }

  const uniqueReasons = [...new Set(reasons)];
  return Object.freeze({
    status: uniqueReasons.length ? "approval_required" : "accepted",
    reasons: Object.freeze(uniqueReasons),
  });
}

function containsSecret(patch) {
  return SECRET_PATTERNS.some((pattern) => pattern.test(patch));
}
