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
export function isSafePrivateObjectPath(objectPath, userId, projectId) {
  if (typeof objectPath !== "string" || typeof userId !== "string" || typeof projectId !== "string" ||
      !userId || !projectId || userId.includes("/") || projectId.includes("/") ||
      objectPath.length > 1024 || objectPath.includes("%") || objectPath.includes("\\\\") ||
      /[\\u0000-\\u001f\\u007f\\u2044\\u2215\\u29f8\\uff0f]/u.test(objectPath)) return false;
  const parts = objectPath.split("/");
  return parts.length === 3 && parts[0] === userId && parts[1] === projectId &&
    Boolean(parts[2]) && parts.every((segment) => segment !== "." && segment !== "..");
}
