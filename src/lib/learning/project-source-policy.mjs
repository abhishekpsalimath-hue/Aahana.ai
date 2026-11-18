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

export function selectRelevantProjectFiles(prompt, files, limit = 8) {
  const promptTokens = tokens(prompt);
  const ranked = (Array.isArray(files) ? files : []).map((file, index) => {
    const filenameTokens = tokens(file?.original_filename);
    let score = 0;
    for (const token of promptTokens) {
      if (filenameTokens.has(token)) score += 3;
    }
    return { file, index, score };
  });
  ranked.sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked.slice(0, Math.max(0, Math.min(8, Number.isInteger(limit) ? limit : 8))).map(({ file }) => file);
}
