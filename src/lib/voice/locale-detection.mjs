const SCRIPT_RULES = [
  { id: "kannada", pattern: /\\p{Script=Kannada}/u, locale: "kn-IN" },
  { id: "tamil", pattern: /\\p{Script=Tamil}/u, locale: "ta-IN" },
  { id: "telugu", pattern: /\\p{Script=Telugu}/u, locale: "te-IN" },
  { id: "malayalam", pattern: /\\p{Script=Malayalam}/u, locale: "ml-IN" },
  { id: "bengali", pattern: /\\p{Script=Bengali}/u, locale: "bn-IN", preferred: /^(bn|as)-/i },
  { id: "gujarati", pattern: /\\p{Script=Gujarati}/u, locale: "gu-IN" },
  { id: "gurmukhi", pattern: /\\p{Script=Gurmukhi}/u, locale: "pa-IN" },
  { id: "odia", pattern: /\\p{Script=Oriya}/u, locale: "or-IN" },
  { id: "devanagari", pattern: /\\p{Script=Devanagari}/u, locale: "hi-IN", preferred: /^(hi|mr|ne|sa|kok|doi)-/i },
  { id: "japanese-kana", pattern: /[ぁ-ゟ゠-ヿ]/u, locale: "ja-JP" },
  { id: "hangul", pattern: /\\p{Script=Hangul}/u, locale: "ko-KR" },
  { id: "han", pattern: /\\p{Script=Han}/u, locale: "zh-CN", preferred: /^(zh|yue)-/i },
  { id: "cyrillic", pattern: /\\p{Script=Cyrillic}/u, locale: "ru-RU", preferred: /^(uk|ru|bg|sr|mk|be)-/i },
  { id: "arabic", pattern: /\\p{Script=Arabic}/u, locale: "ar-SA", preferred: /^(ur|fa|ar|sd)-/i },
  { id: "hebrew", pattern: /\\p{Script=Hebrew}/u, locale: "he-IL" },
  { id: "thai", pattern: /\\p{Script=Thai}/u, locale: "th-TH" },
  { id: "greek", pattern: /\\p{Script=Greek}/u, locale: "el-GR" },
  { id: "armenian", pattern: /\\p{Script=Armenian}/u, locale: "hy-AM" },
  { id: "georgian", pattern: /\\p{Script=Georgian}/u, locale: "ka-GE" },
  { id: "ethiopic", pattern: /\\p{Script=Ethiopic}/u, locale: "am-ET" },
  { id: "myanmar", pattern: /\\p{Script=Myanmar}/u, locale: "my-MM" },
  { id: "lao", pattern: /\\p{Script=Lao}/u, locale: "lo-LA" },
  { id: "khmer", pattern: /\\p{Script=Khmer}/u, locale: "km-KH" },
];
const LATIN_PATTERN = /\\p{Script=Latin}/u;
const LETTER_PATTERN = /\\p{L}/u;

function countMatches(value, pattern) {
  let count = 0;
  for (const character of value) if (pattern.test(character)) count += 1;
  return count;
}

function localeForRule(rule, preferred) {
  return rule.preferred?.test(preferred) ? preferred : rule.locale;
}

/**
 * Returns an explainable, best-effort script profile. This is script detection,
 * not semantic language identification: shared alphabets remain ambiguous.
 */
export function detectSpeechLanguage(text, preferredLocale = "en-IN") {
  const value = String(text || "");
  const preferred = typeof preferredLocale === "string" ? preferredLocale : "en-IN";
  const scriptCounts = {};
  const ranked = [];

  for (const rule of SCRIPT_RULES) {
    const count = countMatches(value, rule.pattern);
    if (count > 0) {
      scriptCounts[rule.id] = count;
      ranked.push({ rule, count });
    }
  }
  const latinCount = countMatches(value, LATIN_PATTERN);
  if (latinCount > 0) scriptCounts.latin = latinCount;

  const recognizedLetters = Object.values(scriptCounts).reduce((sum, count) => sum + count, 0);
  const presentScripts = Object.keys(scriptCounts);
  const isMixed = presentScripts.length > 1;
  if (ranked.length === 0) {
    return Object.freeze({
      locale: preferred,
      script: latinCount ? "latin" : null,
      scriptCounts: Object.freeze(scriptCounts),
      isMixed,
      confidence: latinCount ? 0.55 : 0,
      reason: latinCount ? "latin-script-preserves-preference" : "no-recognized-script",
    });
  }

  ranked.sort((a, b) => b.count - a.count);
  const topCount = ranked[0].count;
  const tied = ranked.filter((entry) => entry.count === topCount);
  let selected = tied.find(({ rule }) => rule.preferred?.test(preferred)) || ranked[0];
  const share = recognizedLetters ? selected.count / recognizedLetters : 0;
  const confidence = Math.round(Math.min(0.99, share * (selected.rule.preferred ? 0.82 : 0.94)) * 100) / 100;

  return Object.freeze({
    locale: localeForRule(selected.rule, preferred),
    script: selected.rule.id,
    scriptCounts: Object.freeze(scriptCounts),
    isMixed,
    confidence,
    reason: tied.length > 1 ? "mixed-script-tie" : isMixed ? "dominant-script-in-mixed-text" : "script-match",
  });
}

/**
 * Script cannot reliably distinguish languages that share an alphabet.
 * Latin text intentionally keeps the user's selected locale.
 */
export function inferSpeechLocale(text, preferredLocale = "en-IN") {
  return detectSpeechLanguage(text, preferredLocale).locale;
}
