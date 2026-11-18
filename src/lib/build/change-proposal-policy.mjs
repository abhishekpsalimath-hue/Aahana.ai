import { createHash } from "node:crypto";
import { validateWorkspacePath } from "./sandbox-policy.mjs";

const MAX_CHANGES = 50;
const MAX_FILE_BYTES = 1 * 1024 * 1024;
const MAX_TOTAL_BYTES = 3 * 1024 * 1024;
const MAX_DIFF_CHARS = 12_000;
const ALLOWED_EXTENSIONS = new Set([
  "js", "jsx", "ts", "tsx", "mjs", "cjs", "css", "html", "htm",
  "json", "md", "txt", "py", "toml", "yaml", "yml", "sql", "sh", "xml", "svg",
]);
const SENSITIVE_FILE_NAME = /(?:^|[._-])(?:credentials?|secrets?|service[-_.]?account|id_rsa|id_ed25519|private[-_.]?key)(?:[._-]|$)/i;

function validateProposalPath(input) {
  const path = validateWorkspacePath(input);
  const filename = path.split("/").at(-1);
  const extension = filename.includes(".") ? filename.split(".").at(-1).toLowerCase() : "";
  if (!ALLOWED_EXTENSIONS.has(extension) || SENSITIVE_FILE_NAME.test(filename)) {
    throw new Error("Only supported source and configuration files may be included in a proposal.");
  }
  return path;
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function validateSourceText(value, label) {
  if (typeof value !== "string") {
    throw new Error(label + " must be text.");
  }
  const bytes = Buffer.byteLength(value, "utf8");
  if (bytes > MAX_FILE_BYTES) {
    throw new Error(label + " must be 1 MB or smaller.");
  }
  return bytes;
}

function makeDiff(path, before, after) {
  const oldLines = before === null ? [] : before.split("\n");
  const newLines = after === null ? [] : after.split("\n");
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length &&
         oldLines[prefix] === newLines[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < oldLines.length - prefix && suffix < newLines.length - prefix &&
         oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]) suffix += 1;

  const removed = oldLines.slice(prefix, oldLines.length - suffix);
  const added = newLines.slice(prefix, newLines.length - suffix);
  const oldStart = Math.max(1, prefix + 1);
  const newStart = Math.max(1, prefix + 1);
  const lines = [
    (before === null ? "--- /dev/null" : "--- a/" + path),
    (after === null ? "+++ /dev/null" : "+++ b/" + path),
    "@@ -" + oldStart + "," + removed.length + " +" + newStart + "," + added.length + " @@",
    ...removed.map((line) => "-" + line),
    ...added.map((line) => "+" + line),
  ];
  const diff = lines.join("\n");
  return diff.length > MAX_DIFF_CHARS ? diff.slice(0, MAX_DIFF_CHARS) + "\n... diff preview truncated ..." : diff;
}

/**
 * Validates a model-generated proposal against the exact project snapshot.
 * This function is intentionally pure with respect to storage: it never writes files.
 * baseSha256 is an optimistic concurrency token, not an approval token.
 */
export function validateChangeProposal({ currentFiles, changes } = {}) {
  if (!Array.isArray(currentFiles) || currentFiles.length > 100) {
    throw new Error("The current project snapshot must contain at most 100 files.");
  }
  if (!Array.isArray(changes) || changes.length < 1 || changes.length > MAX_CHANGES) {
    throw new Error("A change proposal must contain 1–50 file changes.");
  }

  const current = new Map();
  const currentCaseFolded = new Map();
  for (const file of currentFiles) {
    const path = validateProposalPath(file?.path);
    const foldedPath = path.toLowerCase();
    if (current.has(path) || currentCaseFolded.has(foldedPath)) {
      throw new Error("The project snapshot contains duplicate or case-colliding paths.");
    }
    const bytes = validateSourceText(file?.content, "Current file content");
    current.set(path, { content: file.content, sha256: sha256(file.content), bytes });
    currentCaseFolded.set(foldedPath, path);
  }

  const seen = new Set();
  const seenCaseFolded = new Set();
  let totalBytes = 0;
  const validated = changes.map((change) => {
    const path = validateProposalPath(change?.path);
    const foldedPath = path.toLowerCase();
    if (seen.has(path) || seenCaseFolded.has(foldedPath)) {
      throw new Error("A proposal cannot change the same path more than once or use case-colliding paths.");
    }
    seen.add(path);
    seenCaseFolded.add(foldedPath);

    const action = change?.action;
    if (!["create", "update", "delete"].includes(action)) {
      throw new Error("Each change must be create, update or delete.");
    }
    const existing = current.get(path);
    if (action === "create") {
      if (existing || currentCaseFolded.has(foldedPath)) {
        throw new Error("Cannot create a file that already exists or conflicts by path case: " + path);
      }
      if (change.baseSha256 !== null) throw new Error("New files must use a null base hash.");
    } else {
      if (!existing) throw new Error("Cannot update or delete a file missing from the project snapshot: " + path);
      if (typeof change.baseSha256 !== "string" || change.baseSha256 !== existing.sha256) {
        throw new Error("The project file changed since this proposal was prepared: " + path);
      }
    }

    if (action === "delete") {
      if (Object.hasOwn(change, "content")) throw new Error("Deleted files cannot include replacement content.");
      totalBytes += existing.bytes;
      return Object.freeze({
        path, action, baseSha256: existing.sha256, proposedSha256: null,
        before: existing.content, after: null, diff: makeDiff(path, existing.content, null),
      });
    }

    const bytes = validateSourceText(change.content, "Proposed file content");
    totalBytes += bytes;
    if (totalBytes > MAX_TOTAL_BYTES) throw new Error("A proposal cannot exceed 3 MB of changed file content.");
    const proposedSha256 = sha256(change.content);
    if (action === "update" && proposedSha256 === existing.sha256) {
      throw new Error("An update must change the file content: " + path);
    }
    return Object.freeze({
      path, action, baseSha256: existing?.sha256 ?? null, proposedSha256,
      before: existing?.content ?? null, after: change.content,
      diff: makeDiff(path, existing?.content ?? null, change.content),
    });
  });

  if (totalBytes > MAX_TOTAL_BYTES) {
    throw new Error("A proposal cannot exceed 3 MB of changed file content.");
  }

  return Object.freeze({
    status: "proposal-ready",
    writesPerformed: false,
    approvalRequired: true,
    changes: Object.freeze(validated),
  });
}
