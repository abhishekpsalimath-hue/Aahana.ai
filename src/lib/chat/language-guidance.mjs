const SCRIPT_LABELS = Object.freeze([
  ["Kannada", "Kannada"],
  ["Tamil", "Tamil"],
  ["Telugu", "Telugu"],
  ["Malayalam", "Malayalam"],
  ["Bengali", "Bengali"],
  ["Gujarati", "Gujarati"],
  ["Gurmukhi", "Gurmukhi"],
  ["Devanagari", "Devanagari"],
  ["Arabic", "Arabic-derived"],
  ["Hebrew", "Hebrew"],
  ["Thai", "Thai"],
  ["Lao", "Lao"],
  ["Myanmar", "Myanmar"],
  ["Sinhala", "Sinhala"],
  ["Khmer", "Khmer"],
  ["Hangul", "Hangul"],
  ["Hiragana", "Hiragana"],
  ["Katakana", "Katakana"],
  ["Han", "Han"],
  ["Cyrillic", "Cyrillic"],
  ["Greek", "Greek"],
  ["Armenian", "Armenian"],
  ["Georgian", "Georgian"],
]);

const LETTERS = /\p{L}/gu;

/**
 * Return a lightweight, script-aware instruction for multilingual replies.
 * This identifies writing systems, not exact languages: several languages
 * share scripts, so the model must follow the user's wording and context.
 */
export function getLanguageGuidance(message) {
  if (typeof message !== "string" || !message.trim()) return "";

  const letters = message.match(LETTERS) || [];
  if (letters.length < 2) return "";

  const counts = SCRIPT_LABELS.map(([script, label]) => {
    const pattern = new RegExp("\\p{Script=" + script + "}", "gu");
    return { script, label, count: (message.match(pattern) || []).length };
  }).filter((entry) => entry.count > 0);

  if (!counts.length) return "";
  counts.sort((a, b) => b.count - a.count);
  const dominant = counts[0];
  if (dominant.count < 2 || dominant.count / letters.length < 0.25) return "";

  return [
    "The current user message contains substantial " + dominant.label + " script text.",
    "Reply naturally in the same language the user is using and preserve the script they chose.",
    "Do not transliterate, switch to English, or assume a specific language solely from its writing system; some scripts are shared by multiple languages.",
    "If the message mixes languages, follow its dominant natural language and retain useful technical terms as the user wrote them.",
    "If the language is genuinely ambiguous, ask one brief clarification instead of guessing.",
  ].join(" ");
}

export const SUPPORTED_SCRIPT_LABELS = Object.freeze(SCRIPT_LABELS.map(([, label]) => label));
