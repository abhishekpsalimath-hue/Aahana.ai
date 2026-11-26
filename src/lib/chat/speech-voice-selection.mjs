function normalizeLanguageTag(value) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().replace(/_/g, "-");
  try {
    return Intl.getCanonicalLocales(normalized)[0]?.toLowerCase() || "";
  } catch {
    return "";
  }
}

/**
 * Select an installed browser speech voice without assuming every device has
 * the requested regional variant. Exact locale wins; then the same language.
 * Local voices win only as a tie-breaker, not over a better locale match.
 */
export function selectSpeechVoice(voices, language) {
  if (!Array.isArray(voices) || voices.length === 0) return null;
  const requested = normalizeLanguageTag(language);
  if (!requested) return null;
  const languageOnly = requested.split("-")[0];
  const ranked = voices
    .map((voice, index) => {
      const tag = normalizeLanguageTag(voice?.lang);
      if (!tag) return null;
      const exact = tag === requested;
      const sameLanguage = tag.split("-")[0] === languageOnly;
      if (!exact && !sameLanguage) return null;
      return {
        voice,
        index,
        score: (exact ? 100 : 50) + (voice.localService === true ? 2 : 0) +
          (voice.default === true ? 1 : 0),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked[0]?.voice || null;
}
