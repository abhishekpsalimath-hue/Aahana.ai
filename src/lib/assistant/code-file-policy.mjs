export function getSafeCodeFilePath(label) {
  const parts = String(label || "").trim().split(/\s+/);
  const filePath = parts.slice(1).join(" ");
  if (
    !filePath ||
    filePath.startsWith("/") ||
    filePath.split("/").some((part) => !part || part === "." || part === "..") ||
    !/^[A-Za-z0-9._/-]+$/.test(filePath)
  ) return null;
  return filePath;
}

export function getCodeDownloadName(filePath) {
  const safePath = getSafeCodeFilePath(\`code \${String(filePath || "")}\`);
  return safePath ? safePath.replace(/\//g, "__") : null;
}
