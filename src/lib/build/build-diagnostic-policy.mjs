const MAX_DIAGNOSTICS = 20;
const MAX_MESSAGE_LENGTH = 1200;

function cleanPath(value) {
  if (typeof value !== "string") return null;
  const normalized = value.split("\\").join("/").startsWith("./") ? value.split("\\").join("/").slice(2) : value.split("\\").join("/");
  if (!normalized || normalized.length > 240 || normalized.startsWith("/") || normalized.split("/").includes("..")) return null;
  return normalized;
}

function diagnostic({ source, severity = "error", code = null, file = null, line = null, column = null, message }) {
  const text = String(message || "").trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!text) return null;
  return Object.freeze({
    source,
    severity,
    code: code ? String(code).slice(0, 80) : null,
    file: cleanPath(file),
    line: Number.isInteger(line) && line > 0 ? line : null,
    column: Number.isInteger(column) && column > 0 ? column : null,
    message: text,
  });
}

/** Extracts bounded, best-effort diagnostics from common compiler and runtime output. */
export function extractBuildDiagnostics({ stdout = "", stderr = "", exitCode = 0, operation = "build" } = {}) {
  const output = [String(stderr || ""), String(stdout || "")].join("\n").slice(0, 24000);
  const results = [];
  const seen = new Set();
  const add = (item) => {
    if (!item) return;
    const key = [item.source, item.file, item.line, item.column, item.code, item.message].join("|");
    if (seen.has(key) || results.length >= MAX_DIAGNOSTICS) return;
    seen.add(key);
    results.push(item);
  };

  for (const rawLine of output.split(/\r?\n/)) {
    const lineText = rawLine.trim();
    if (!lineText) continue;
    let match;
    if ((match = lineText.match(/^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+):\s*(.+)$/i))) {
      add(diagnostic({ source: "typescript", file: match[1], line: Number(match[2]), column: Number(match[3]), severity: match[4].toLowerCase(), code: match[5], message: match[6] }));
    } else if ((match = lineText.match(/^(.+?):(\d+):(\d+):\s*(ERROR|WARNING):\s*(.+)$/i))) {
      add(diagnostic({ source: "compiler", file: match[1], line: Number(match[2]), column: Number(match[3]), severity: match[4].toLowerCase(), message: match[5] }));
    } else if ((match = lineText.match(/^(.+?)\s+(\d+):(\d+)\s+(error|warning)\s+(.+?)(?:\s{2,}([\w/-]+))?$/i))) {
      add(diagnostic({ source: "eslint", file: match[1], line: Number(match[2]), column: Number(match[3]), severity: match[4].toLowerCase(), code: match[6] || null, message: match[5] }));
    } else if ((match = lineText.match(/^File ["'](.+?)["'], line (\d+)/))) {
      add(diagnostic({ source: "python", file: match[1], line: Number(match[2]), message: "Python traceback location" }));
    } else if ((match = lineText.match(/^npm ERR! code (.+)$/))) {
      add(diagnostic({ source: "npm", code: match[1], message: "npm reported an installation or script error." }));
    } else if (/^Module not found:|^Cannot find module |^Error: Cannot find module /.test(lineText)) {
      add(diagnostic({ source: "runtime", message: lineText }));
    }
  }

  if (Number(exitCode) !== 0 && results.length === 0) {
    add(diagnostic({
      source: "process",
      message: operation === "test"
        ? "The test command exited unsuccessfully. Review the captured output for details."
        : "The command exited unsuccessfully. Review the captured output for details.",
    }));
  }
  return Object.freeze(results);
}
