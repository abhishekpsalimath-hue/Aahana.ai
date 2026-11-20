const FULL_SHA = /^[a-f0-9]{40}$/i;
const MAX_FILES = 100;
const MAX_FILE_BYTES = 1 * 1024 * 1024;
const MAX_TOTAL_BYTES = 3 * 1024 * 1024;
const BLOCKED_SEGMENTS = new Set([".git", ".vercel", ".next", "node_modules", "coverage", "dist", "build"]);
const BLOCKED_NAMES = new Set([".env", ".env.local", ".env.production", ".npmrc", ".pypirc", "npm-shrinkwrap.json"]);

function validateSnapshotPath(input) {
  if (typeof input !== "string" || input.length < 1 || input.length > 240 ||
      /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(input) ||
      input.includes("\\") || input.startsWith("/") || /^[a-zA-Z]:/.test(input)) {
    throw new Error("unsafe_repository_snapshot_path");
  }
  const segments = input.split("/");
  if (segments.some((segment) =>
    !segment || segment === "." || segment === ".." ||
    BLOCKED_SEGMENTS.has(segment.toLowerCase()) ||
    BLOCKED_NAMES.has(segment.toLowerCase()) ||
    segment.toLowerCase().startsWith(".env.")
  )) throw new Error("unsafe_repository_snapshot_path");
  return segments.join("/");
}

/**
 * Read an explicitly allowlisted source snapshot from one immutable commit.
 * The GitHub adapter remains server-side; only validated text files are
 * returned. This function never writes to GitHub or starts a sandbox.
 */
export async function collectReadOnlyRepositorySnapshot({
  github,
  sourceSha,
  allowedPaths,
}) {
  if (!github || typeof github.getCommitTree !== "function" ||
      typeof github.getBlob !== "function") {
    throw new Error("trusted_readonly_github_adapter_required");
  }
  if (!FULL_SHA.test(sourceSha || "")) {
    throw new Error("immutable_source_commit_required");
  }
  if (!Array.isArray(allowedPaths) || allowedPaths.length < 1 ||
      allowedPaths.length > MAX_FILES) {
    throw new Error("explicit_repository_path_allowlist_required");
  }

  const normalizedPaths = allowedPaths.map(validateSnapshotPath);
  if (new Set(normalizedPaths).size !== normalizedPaths.length) {
    throw new Error("duplicate_repository_allowlist_paths");
  }

  const tree = await github.getCommitTree({ sha: sourceSha });
  if (!tree?.complete || tree.truncated === true || !Array.isArray(tree.entries)) {
    throw new Error("complete_repository_tree_required");
  }

  const entries = new Map();
  for (const entry of tree.entries) {
    if (typeof entry?.path !== "string" || entries.has(entry.path)) {
      throw new Error("ambiguous_repository_tree_entries");
    }
    entries.set(entry.path, entry);
  }

  const files = [];
  let totalBytes = 0;
  for (const path of normalizedPaths) {
    const entry = entries.get(path);
    if (!entry) throw new Error("allowlisted_repository_file_missing");
    if (entry.mode !== "100644" && entry.mode !== "100755") {
      throw new Error("non_regular_repository_file_rejected");
    }
    if (entry.type !== "blob" || !FULL_SHA.test(entry.sha || "")) {
      throw new Error("invalid_repository_blob_reference");
    }
    if (!Number.isInteger(entry.size) || entry.size < 0 || entry.size > MAX_FILE_BYTES) {
      throw new Error("repository_file_size_limit_exceeded");
    }
    totalBytes += entry.size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new Error("repository_snapshot_size_limit_exceeded");
    }

    const blob = await github.getBlob({ sha: entry.sha });
    if (blob?.sha !== entry.sha || blob.encoding !== "base64" ||
        !Number.isInteger(blob.size) || blob.size !== entry.size ||
        typeof blob.content !== "string") {
      throw new Error("repository_blob_response_mismatch");
    }
    const bytes = Buffer.from(blob.content.replace(/\\s/g, ""), "base64");
    if (bytes.byteLength !== entry.size) {
      throw new Error("repository_blob_size_mismatch");
    }
    let content;
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new Error("binary_repository_files_are_not_supported");
    }
    files.push({ path, content, bytes: bytes.byteLength });
  }

  return files;
}
