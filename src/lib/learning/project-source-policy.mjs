const STOP_WORDS = new Set(["about","after","again","also","and","are","build","can","create","file","for","from","help","how","into","make","need","please","project","that","the","this","with","you","your"]);

function tokens(value) {
  return new Set(
    String(value || "")
      .toLowerCase()
      .normalize("NFKC")
      .match(/[\p{L}\p{N}]{2,}/gu)
      ?.filter((token) => !STOP_WORDS.has(token)) || []
  );
}

function coreFileScore(filename) {
  const normalized = String(filename || "").toLowerCase().replace(/\\/g, "/");
  const basename = normalized.split("/").pop();
  if (basename === "package.json") return 100;
  if (["tsconfig.json", "jsconfig.json"].includes(basename)) return 90;
  if (/^(?:next|vite)\.config\.(?:js|mjs|ts)$/.test(basename) ||
      /^(?:astro|svelte)\.config\.(?:js|mjs|ts)$/.test(basename)) return 85;
  if (basename === "index.html") return 80;
  if (basename === "readme.md") return 2;
  if (/^(?:src\/)?(?:app|pages)\/(?:page|layout|index)\.(?:js|jsx|ts|tsx)$/.test(normalized)) return 80;
  if (/^(?:src\/)?(?:main|index)\.(?:js|jsx|ts|tsx)$/.test(normalized)) return 70;
  return 0;
}

export function selectRelevantProjectFiles(prompt, files, limit = 8) {
  const promptTokens = tokens(prompt);
  const ranked = (Array.isArray(files) ? files : []).map((file, index) => {
    const filename = String(file?.original_filename || "");
    const filenameTokens = tokens(filename);
    let score = coreFileScore(filename);
    for (const token of promptTokens) {
      if (filenameTokens.has(token)) score += 3;
    }
    return { file, index, score };
  });
  ranked.sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked.slice(0, Math.max(0, Math.min(8, Number.isInteger(limit) ? limit : 8))).map(({ file }) => file);
}
