/**
 * Browser speech capability helpers.
 *
 * Browser speech APIs are a best-effort fallback, not Aahana's multilingual
 * voice engine. A locale is only output-ready when the device exposes a
 * matching installed voice.
 */
export function findBestSpeechVoice(voices = [], locale = "") {
  const requested = String(locale || "").trim().toLowerCase();
  if (!requested || !Array.isArray(voices)) return null;
  const exact = voices.find((voice) => String(voice?.lang || "").trim().toLowerCase() === requested);
  if (exact) return exact;
  const language = requested.split("-")[0];
  if (!language) return null;
  return voices.find((voice) =>
    String(voice?.lang || "").trim().toLowerCase().split("-")[0] === language
  ) || null;
}

export function getBrowserVoiceCapabilities({
  recognitionAvailable = false,
  synthesisAvailable = false,
  voices = [],
} = {}) {
  const installedOutputLocales = [...new Set(
    (Array.isArray(voices) ? voices : [])
      .map((voice) => String(voice?.lang || "").trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));
  return {
    inputAvailable: Boolean(recognitionAvailable),
    outputAvailable: Boolean(synthesisAvailable),
    installedOutputLocales,
    hasInstalledOutputVoice: installedOutputLocales.length > 0,
  };
}
