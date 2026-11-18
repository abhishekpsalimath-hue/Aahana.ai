import { validateWorkspacePath } from "./sandbox-policy.mjs";

const SOURCE_EXTENSIONS = new Set([
  "js", "jsx", "ts", "tsx", "mjs", "cjs", "css", "html", "htm",
  "json", "md", "txt", "py", "toml", "yaml", "yml", "sql", "sh", "xml", "svg",
]);

/**
 * Resolve a stored upload name to its workspace-relative source path.
 * Never repair an unsafe path: normalising absolute or Windows paths could
 * make two different stored names collide with a valid project path.
 * Unsupported file types return null so documents and media stay out of code proposals.
 */
export function toProposalSnapshotPath(filename) {
  if (typeof filename !== "string" || !filename.trim()) {
    throw new Error("Project source filename is invalid.");
  }

  const path = validateWorkspacePath(filename);
  const extension = path.split("/").at(-1).split(".").at(-1).toLowerCase();
  return SOURCE_EXTENSIONS.has(extension) ? path : null;
}
