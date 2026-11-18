const STOP_WORDS = new Set(["about","after","again","also","and","are","build","can","create","file","for","from","help","how","into","make","need","please","project","that","the","this","with","you","your"]);

function tokens(value) {
  return new Set(
    String(value || "")
      .normalize("NFKC")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .toLowerCase()
      .match(/[\p{L}\p{N}]{2,}/gu)
      ?.filter((token) => !STOP_WORDS.has(token)) || []
  );
}

function coreFileScore(filename) {
  const normalized = String(filename || "").toLowerCase().replace(/\\/g, "/");
  const basename = normalized.split("/").pop();
  if (basename === "package.json") return 120;
  if (["tsconfig.json", "jsconfig.json"].includes(basename)) return 100;
  if (/^(?:next|vite|astro|svelte|vitest|jest)\.config\.(?:js|mjs|cjs|ts)$/.test(basename) ||
      /^eslint\.config\.(?:js|mjs|cjs|ts)$/.test(basename)) return 90;
  if (basename === "index.html") return 85;
  if (/^(?:src\/)?(?:app|pages)\/(?:page|layout|index)\.(?:js|jsx|ts|tsx)$/.test(normalized)) return 85;
  if (/^(?:src\/)?(?:main|index)\.(?:js|jsx|ts|tsx)$/.test(normalized)) return 75;
  if (/(?:^|\/)readme\.md$/.test(normalized)) return 2;
  return 0;
}

function contextualFileScore(filename, promptTokens) {
  const normalized = String(filename || "").toLowerCase().replace(/\\/g, "/");
  const basename = normalized.split("/").pop();
  let score = 0;
  const asksForTests = ["test", "tests", "spec", "coverage", "regression", "bug", "failing"].some((word) => promptTokens.has(word));
  const isTestFile = /(?:\.test|\.spec)\.[cm]?[jt]sx?$/.test(basename) ||
    /(?:^|\/)__tests__(?:\/|$)/.test(normalized) ||
    /(?:^|\/)(?:tests?|spec)(?:\/|$)/.test(normalized);
  if (asksForTests && isTestFile) score += 65;
  if (/(?:^|\/)app\/api\//.test(normalized) && ["api", "endpoint", "route", "backend", "server"].some((word) => promptTokens.has(word))) score += 55;
  if (/\.(?:d\.ts|types\.[jt]sx?)$/.test(basename) && ["type", "types", "interface", "schema", "contract"].some((word) => promptTokens.has(word))) score += 45;
  return score;
}

export function selectRelevantProjectFiles(prompt, files, limit = 8) {
  const promptTokens = tokens(prompt);
  const ranked = (Array.isArray(files) ? files : []).map((file, index) => {
    const filename = String(file?.original_filename || file?.path || "");
    const filenameTokens = tokens(filename);
    const contentTokens = tokens(String(file?.content || "").slice(0, 40000));
    let score = coreFileScore(filename) + contextualFileScore(filename, promptTokens);
    let contentMatches = 0;
    for (const token of promptTokens) {
      if (filenameTokens.has(token)) score += 40;
      else if (contentMatches < 10 && contentTokens.has(token)) {
        score += 2;
        contentMatches += 1;
      }
    }
    return { file, index, score };
  });
  ranked.sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked.slice(0, Math.max(0, Math.min(8, Number.isInteger(limit) ? limit : 8))).map(({ file }) => file);
}
