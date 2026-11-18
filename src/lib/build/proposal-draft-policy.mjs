import { createHash } from "node:crypto";
import { validateWorkspacePath } from "./sandbox-policy.mjs";

const MAX_CHANGES = 50;
const MAX_SUMMARY_LENGTH = 500;
const ALLOWED_EXTENSIONS = new Set([
  "js", "jsx", "ts", "tsx", "mjs", "cjs", "css", "html", "htm",
  "json", "md", "txt", "py", "toml", "yaml", "yml", "sql", "sh", "xml", "svg",
]);

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Converts an untrusted model draft into the server-owned proposal contract.
 * The model never supplies base hashes: the server derives them from the
 * exact snapshot being reviewed. This helper performs no storage writes.
 */
export function prepareChangeProposalDraft({ currentFiles, draft } = {}) {
  if (!Array.isArray(currentFiles) || currentFiles.length > 100) {
    throw new Error("The current project snapshot must contain at most 100 files.");
  }
  if (!draft || typeof draft !== "object" || Array.isArray(draft) ||
      draft.type !== "aahana_code_change_proposal_v1" ||
      typeof draft.summary !== "string" ||
      !draft.summary.trim() ||
      draft.summary.length > MAX_SUMMARY_LENGTH ||
      !Array.isArray(draft.changes) ||
      draft.changes.length < 1 ||
      draft.changes.length > MAX_CHANGES) {
    throw new Error("The AI response is not a valid Aahana code change proposal.");
  }

  const snapshot = new Map();
  for (const file of currentFiles) {
    const path = validateWorkspacePath(file?.path);
    if (snapshot.has(path)) throw new Error("The current project snapshot contains duplicate paths.");
    if (typeof file?.content !== "string") throw new Error("Current project files must contain text.");
    snapshot.set(path, file.content);
  }

  const seen = new Set();
  const changes = draft.changes.map((change) => {
    if (!change || typeof change !== "object" || Array.isArray(change)) {
      throw new Error("Each proposed change must be an object.");
    }
    const keys = Object.keys(change).sort();
    if (keys.some((key) => !["path", "action", "content"].includes(key)) ||
        !keys.includes("path") || !keys.includes("action")) {
      throw new Error("Each proposed change may contain only path, action and content.");
    }

    const path = validateWorkspacePath(change.path);
    const filename = path.split("/").at(-1);
    const extension = filename.includes(".") ? filename.split(".").at(-1).toLowerCase() : "";
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new Error("Only supported source and configuration files may be proposed.");
    }
    if (seen.has(path)) throw new Error("A proposal cannot change the same path more than once.");
    seen.add(path);

    const exists = snapshot.has(path);
    if (change.action === "create") {
      if (exists || typeof change.content !== "string") {
        throw new Error("A create operation must target a new file and include text content.");
      }
      return { path, action: "create", baseSha256: null, content: change.content };
    }
    if (change.action === "update") {
      if (!exists || typeof change.content !== "string") {
        throw new Error("An update operation must target an existing file and include replacement text.");
      }
      return { path, action: "update", baseSha256: sha256(snapshot.get(path)), content: change.content };
    }
    if (change.action === "delete") {
      if (!exists || Object.hasOwn(change, "content")) {
        throw new Error("A delete operation must target an existing file and cannot include content.");
      }
      return { path, action: "delete", baseSha256: sha256(snapshot.get(path)) };
    }
    throw new Error("Each proposed change must be create, update or delete.");
  });

  return Object.freeze({
    type: draft.type,
    summary: draft.summary.trim(),
    changes: Object.freeze(changes.map((change) => Object.freeze(change))),
  });
}
