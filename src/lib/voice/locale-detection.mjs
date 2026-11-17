const SCRIPT_RULES = [
  [/\\p{Script=Kannada}/u, "kn-IN"],
  [/\\p{Script=Tamil}/u, "ta-IN"],
  [/\\p{Script=Telugu}/u, "te-IN"],
  [/\\p{Script=Malayalam}/u, "ml-IN"],
  [/\\p{Script=Bengali}/u, null, /^(bn|as)-/i, "bn-IN"],
  [/\\p{Script=Gujarati}/u, "gu-IN"],
  [/\\p{Script=Gurmukhi}/u, "pa-IN"],
  [/\\p{Script=Oriya}/u, "or-IN"],
  [/\\p{Script=Devanagari}/u, null, /^(hi|mr|ne|sa|kok|doi)-/i, "hi-IN"],
  [/[ぁ-ゟ゠-ヿ]/u, "ja-JP"],
  [/\\p{Script=Hangul}/u, "ko-KR"],
  [/\\p{Script=Han}/u, null, /^(zh|yue)-/i, "zh-CN"],
  [/\\p{Script=Cyrillic}/u, null, /^(uk|ru|bg|sr|mk|be)-/i, "ru-RU"],
  [/\\p{Script=Arabic}/u, null, /^(ur|fa|ar|sd)-/i, "ar-SA"],
  [/\\p{Script=Hebrew}/u, "he-IL"],
  [/\\p{Script=Thai}/u, "th-TH"],
  [/\\p{Script=Greek}/u, "el-GR"],
  [/\\p{Script=Armenian}/u, "hy-AM"],
  [/\\p{Script=Georgian}/u, "ka-GE"],
  [/\\p{Script=Ethiopic}/u, "am-ET"],
  [/\\p{Script=Myanmar}/u, "my-MM"],
  [/\\p{Script=Lao}/u, "lo-LA"],
  [/\\p{Script=Khmer}/u, "km-KH"],
];

/**
 * Best-effort script-based locale inference for speech playback.
 * Script cannot reliably distinguish languages that share an alphabet;
 * in those cases a compatible user-selected locale is preserved.
 * Latin text intentionally keeps the user's preferred locale.
 */
export function inferSpeechLocale(text, preferredLocale = "en-IN") {
  const value = String(text || "");
  const preferred = typeof preferredLocale === "string" ? preferredLocale : "en-IN";
  for (const [pattern, fixedLocale, preferredPattern, fallbackLocale] of SCRIPT_RULES) {
    if (!pattern.test(value)) continue;
    if (preferredPattern?.test(preferred)) return preferred;
    return fixedLocale || fallbackLocale;
  }
  return preferred;
}
