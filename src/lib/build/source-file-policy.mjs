const MIME_BY_EXTENSION = Object.freeze({
  js: "text/javascript", jsx: "text/javascript", ts: "text/javascript", tsx: "text/javascript",
  mjs: "text/javascript", cjs: "text/javascript", css: "text/css", html: "text/html", htm: "text/html",
  json: "application/json", py: "text/x-python", md: "text/markdown", txt: "text/plain",
  toml: "text/plain", yaml: "text/plain", yml: "text/plain", sql: "text/plain",
});

function extensionOf(filename) {
  if (typeof filename !== "string") return "";
  const name = filename.trim().split(/[\\/]/).pop() || "";
  const index = name.lastIndexOf(".");
  return index > 0 ? name.slice(index + 1).toLowerCase() : "";
}

export function getSourceFileMimeType(filename, reportedMimeType = "") {
  return MIME_BY_EXTENSION[extensionOf(filename)] || reportedMimeType || "";
}

export function isSupportedSourceFile(filename, mimeType) {
  const expected = MIME_BY_EXTENSION[extensionOf(filename)];
  return Boolean(expected && (mimeType === expected || mimeType === "application/octet-stream" || mimeType === "text/plain"));
}