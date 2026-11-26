const speechScripts = [
  [/[\u0C80-\u0CFF]/gu, "kn-IN"],
  [/[\u0B80-\u0BFF]/gu, "ta-IN"],
  [/[\u0C00-\u0C7F]/gu, "te-IN"],
  [/[\u0D00-\u0D7F]/gu, "ml-IN"],
  [/[\u0980-\u09FF]/gu, "bn-IN"],
  [/[\u0A80-\u0AFF]/gu, "gu-IN"],
  [/[\u0A00-\u0A7F]/gu, "pa-IN"],
  [/[\u0B00-\u0B7F]/gu, "or-IN"],
  [/[\u0900-\u097F]/gu, "hi-IN"],
  [/[\u0E00-\u0E7F]/gu, "th-TH"],
  [/[\uAC00-\uD7AF]/gu, "ko-KR"],
  [/[\u3040-\u309F]/gu, "ja-JP"],
  [/[\u30A0-\u30FF]/gu, "ja-JP"],
  [/[\u4E00-\u9FFF]/gu, "zh-CN"],
  [/[\u0400-\u04FF]/gu, "ru-RU"],
  [/[\u0590-\u05FF]/gu, "he-IL"],
  [/[\u0600-\u06FF]/gu, "ar-SA"],
];

function countMatches(value, pattern) {
  return [...value.matchAll(pattern)].length;
}

/** Infer a browser speech-synthesis locale from the response script, with a device-locale fallback. */
export function inferSpeechLanguage(value, fallback = "en-IN") {
  const text = typeof value === "string" ? value : "";
  const safeFallback = typeof fallback === "string" && /^[a-z]{2,3}(?:-[A-Z]{2})?$/i.test(fallback)
    ? fallback
    : "en-IN";
  let best = { count: 0, language: safeFallback };
  for (const [pattern, language] of speechScripts) {
    const count = countMatches(text, pattern);
    if (count > best.count) best = { count, language };
  }
  if (best.count > 0) return best.language;
  if (/[ăâđêôơưạ-ỹ]/iu.test(text)) return "vi-VN";
  if (/[ãõ]/iu.test(text)) return "pt-BR";
  if (/[¿¡ñáéíóú]/iu.test(text)) return "es-ES";
  if (/[ğışİç]/u.test(text)) return "tr-TR";
  if (/[äöüß]/iu.test(text)) return "de-DE";
  if (/[àâçéèêëîïôûùÿœ]/iu.test(text)) return "fr-FR";
  return safeFallback;
}
