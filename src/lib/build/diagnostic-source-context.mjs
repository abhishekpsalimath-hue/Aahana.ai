const MAX_CONTEXT_LINES = 7;
const MAX_CONTEXT_CHARS = 1800;

function normalizePath(value) {
  if (typeof value !== "string") return null;
  const path = value.split("\\").join("/").replace(/^\.\//, "");
  if (!path || path.startsWith("/") || path.split("/").includes("..")) return null;
  return path;
}

/**
 * Adds a small source excerpt only when a diagnostic points to an exact
 * submitted workspace path. This is context for review, never an edit.
 */
export function attachDiagnosticSourceContext(diagnostics, files) {
  if (!Array.isArray(diagnostics) || !Array.isArray(files)) return [];
  const sourceByPath = new Map();
  for (const file of files) {
    const path = normalizePath(file?.path);
    if (path && typeof file.content === "string" && !sourceByPath.has(path)) {
      sourceByPath.set(path, file.content);
    }
  }

  return diagnostics.slice(0, 20).map((item) => {
    const path = normalizePath(item?.file);
    const source = path ? sourceByPath.get(path) : null;
    const line = Number.isInteger(item?.line) && item.line > 0 ? item.line : null;
    if (source === null || line === null) return Object.freeze({ ...item, sourceContext: null });

    const lines = source.split(/\r?\n/);
    if (line > lines.length) return Object.freeze({ ...item, sourceContext: null });
    const start = Math.max(1, line - 3);
    const end = Math.min(lines.length, line + 3, start + MAX_CONTEXT_LINES - 1);
    const excerpt = lines.slice(start - 1, end)
      .map((text, index) => {
        const number = start + index;
        return (number === line ? "> " : "  ") + String(number).padStart(4, " ") + " | " + text;
      })
      .join("\n")
      .slice(0, MAX_CONTEXT_CHARS);

    return Object.freeze({
      ...item,
      sourceContext: Object.freeze({ startLine: start, endLine: end, excerpt }),
    });
  });
}
