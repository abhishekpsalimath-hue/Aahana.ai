import { normalizeLocale } from "./speech-runtime.mjs";

/**
 * Report recognition and synthesis coverage independently.
 * A locale is supported only when the corresponding configured provider
 * explicitly lists that canonical BCP 47 locale.
 */
export function getSpeechLocaleSupport(capabilities, locale) {
  const normalized = normalizeLocale(locale);
  const recognitionLocales = Array.isArray(capabilities?.recognition?.supportedLocales)
    ? capabilities.recognition.supportedLocales : [];
  const synthesisLocales = Array.isArray(capabilities?.synthesis?.supportedLocales)
    ? capabilities.synthesis.supportedLocales : [];
  const recognition = recognitionLocales.some((item) => {
    try { return normalizeLocale(item) === normalized; } catch { return false; }
  }) && capabilities?.recognition?.enabled !== false;
  const synthesis = synthesisLocales.some((item) => {
    try { return normalizeLocale(item) === normalized; } catch { return false; }
  }) && capabilities?.synthesis?.enabled !== false;
  return Object.freeze({
    locale: normalized,
    recognition,
    synthesis,
    fullDuplex: recognition && synthesis,
    status: recognition && synthesis ? "ready"
      : recognition ? "recognition-only"
      : synthesis ? "synthesis-only"
      : "unsupported",
  });
}

export function getCommonSpeechLocales(capabilities) {
  const recognition = new Set(
    (capabilities?.recognition?.supportedLocales || []).flatMap((locale) => {
      try { return [normalizeLocale(locale)]; } catch { return []; }
    }),
  );
  const synthesis = new Set(
    (capabilities?.synthesis?.supportedLocales || []).flatMap((locale) => {
      try { return [normalizeLocale(locale)]; } catch { return []; }
    }),
  );
  return [...recognition].filter((locale) =>
    synthesis.has(locale)
      && capabilities?.recognition?.enabled !== false
      && capabilities?.synthesis?.enabled !== false
  ).sort((a, b) => a.localeCompare(b));
}
