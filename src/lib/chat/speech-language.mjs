const speechScripts = [
  [/\\p{Script=Kannada}/gu, "kn-IN"],
  [/\\p{Script=Tamil}/gu, "ta-IN"],
  [/\\p{Script=Telugu}/gu, "te-IN"],
  [/\\p{Script=Malayalam}/gu, "ml-IN"],
  [/\\p{Script=Bengali}/gu, "bn-IN"],
  [/\\p{Script=Gujarati}/gu, "gu-IN"],
  [/\\p{Script=Gurmukhi}/gu, "pa-IN"],
  [/\\p{Script=Oriya}/gu, "or-IN"],
  [/\\p{Script=Devanagari}/gu, "hi-IN"],
  [/\\p{Script=Thai}/gu, "th-TH"],
  [/\\p{Script=Hangul}/gu, "ko-KR"],
  [/\\p{Script=Hiragana}/gu, "ja-JP"],
  [/\\p{Script=Katakana}/gu, "ja-JP"],
  [/\\p{Script=Han}/gu, "zh-CN"],
  [/\\p{Script=Cyrillic}/gu, "ru-RU"],
  [/\\p{Script=Hebrew}/gu, "he-IL"],
  [/\\p{Script=Arabic}/gu, "ar-SA"],
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
  if (/[¿¡ñáéíóú]/iu.test(text)) return "es-ES";
  if (/[àâçéèêëîïôûùüÿœ]/iu.test(text)) return "fr-FR";
  if (/[äöüß]/iu.test(text)) return "de-DE";
  if (/[ãõ]/iu.test(text)) return "pt-BR";
  if (/[ğışİç]/u.test(text)) return "tr-TR";
  return safeFallback;
}
