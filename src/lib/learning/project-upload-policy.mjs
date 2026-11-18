const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

// Source formats are converted to text/plain before private storage. Secret
// environment files and key/certificate formats are deliberately excluded.
export const PROJECT_CODE_EXTENSIONS = Object.freeze([
  "html", "htm", "css", "scss", "sass", "less",
  "js", "jsx", "mjs", "cjs", "ts", "tsx",
  "vue", "svelte", "astro", "md", "mdx",
  "json", "jsonc", "json5", "xml", "yaml", "yml", "toml",
  "sql", "prisma", "graphql", "gql", "proto",
  "py", "pyi", "ipynb", "rb", "php", "go", "rs", "java",
  "kt", "kts", "swift", "dart", "cs", "fs", "fsx",
  "c", "h", "cc", "cpp", "cxx", "hpp", "hh",
  "sh", "bash", "zsh", "ps1", "bat", "cmd",
  "lua", "r", "jl", "scala", "sc", "ex", "exs",
  "erl", "hrl", "hs", "lhs", "clj", "cljs", "cljc",
  "gradle", "tf", "hcl", "ini", "conf", "properties",
]);

const CODE_EXTENSION_SET = new Set(PROJECT_CODE_EXTENSIONS);

export function getProjectUploadKind(fileName, mimeType) {
  const name = String(fileName || "").replace(/\\/g, "/").split("/").pop().toLowerCase();
  if (!name || name === ".env" || name.startsWith(".env.")) return null;

  const extension = name.includes(".") ? name.split(".").pop() : "";
  if (CODE_EXTENSION_SET.has(extension)) return "code";
  if (DOCUMENT_MIME_TYPES.has(String(mimeType || "").toLowerCase())) return "document";
  return null;
}
