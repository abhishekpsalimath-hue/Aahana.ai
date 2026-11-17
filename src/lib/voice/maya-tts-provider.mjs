import { SpeechProviderError } from "./speech-runtime.mjs";

const MAYA_LANGUAGE_CODES = Object.freeze({
  "as-IN": "as",
  "bn-IN": "bn",
  "en-IN": "en",
  "en-US": "en",
  "en-GB": "en",
  "gu-IN": "gu",
  "hi-IN": "hi",
  "kn-IN": "kn",
  "ml-IN": "ml",
  "mr-IN": "mr",
  "or-IN": "or",
  "pa-IN": "pa",
  "ta-IN": "ta",
  "te-IN": "te",
});

const DEFAULT_VOICES = ["Ahana", "Vaidehi", "Malini", "Charvi", "Jahnavi", "Anirban", "Nakul", "Vasant", "Siddhant", "Satvik", "Abhay", "Nivedita", "Ishwari", "Ritvik", "Vrinda", "Sreekar", "Kayal", "Shaunak", "Akshat", "Tanushree"];

/**
 * Create a provider adapter for a privately hosted Maya 2 Native server.
 *
 * The model server has no built-in authentication. Keep it on a private
 * network or behind an authenticated reverse proxy; never expose it directly.
 * This adapter is inert until a trusted server-side caller supplies a base URL.
 */
export function createMayaTtsProvider({
  baseUrl,
  voice = "Ahana",
  fetchImpl = globalThis.fetch,
  authorizationToken = "",
} = {}) {
  const normalizedBaseUrl = typeof baseUrl === "string" ? baseUrl.trim().replace(/\/+$/, "") : "";
  let parsedUrl = null;
  if (normalizedBaseUrl) {
    try {
      parsedUrl = new URL(normalizedBaseUrl);
    } catch {
      throw new SpeechProviderError("Maya endpoint must be a valid URL.", "INVALID_PROVIDER_CONFIG");
    }
    const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(parsedUrl.hostname);
    if (parsedUrl.protocol !== "https:" && !(parsedUrl.protocol === "http:" && isLoopback)) {
      throw new SpeechProviderError("Maya endpoint must use HTTPS unless it is loopback.", "INSECURE_PROVIDER_ENDPOINT");
    }
  }
  if (typeof fetchImpl !== "function") {
    throw new SpeechProviderError("A fetch implementation is required.", "INVALID_PROVIDER_CONFIG");
  }
  if (typeof voice !== "string" || !DEFAULT_VOICES.includes(voice)) {
    throw new SpeechProviderError("Choose a documented Maya built-in voice.", "INVALID_PROVIDER_CONFIG");
  }

  return Object.freeze({
    id: "maya-2-native",
    supportedLocales: Object.keys(MAYA_LANGUAGE_CODES),
    isAvailable: () => Boolean(parsedUrl),
    async synthesize({ text, locale, signal }) {
      if (!parsedUrl) throw new SpeechProviderError("Maya endpoint is not configured.", "PROVIDER_UNAVAILABLE");
      const language = MAYA_LANGUAGE_CODES[locale];
      if (!language) throw new SpeechProviderError(`Maya does not support ${locale}.`, "UNSUPPORTED_LOCALE");
      const headers = { "Content-Type": "application/json", Accept: "audio/wav" };
      if (authorizationToken) headers.Authorization = `Bearer ${authorizationToken}`;
      let response;
      try {
        response = await fetchImpl(new URL("/v1/audio/speech", parsedUrl), {
          method: "POST",
          headers,
          body: JSON.stringify({ input: text, language, voice, response_format: "wav" }),
          signal,
        });
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        throw new SpeechProviderError("Could not reach the private Maya speech service.", "PROVIDER_CONNECTION_FAILED");
      }
      if (!response.ok) {
        throw new SpeechProviderError(`Maya speech service returned HTTP ${response.status}.`, "PROVIDER_REQUEST_FAILED");
      }
      const mimeType = String(response.headers?.get?.("content-type") || "").split(";")[0].trim().toLowerCase();
      if (!mimeType.startsWith("audio/")) {
        throw new SpeechProviderError("Maya returned a non-audio response.", "INVALID_PROVIDER_RESPONSE");
      }
      const audio = new Uint8Array(await response.arrayBuffer());
      if (!audio.byteLength) throw new SpeechProviderError("Maya returned an empty audio response.", "EMPTY_AUDIO");
      if (audio.byteLength > 20 * 1024 * 1024) {
        throw new SpeechProviderError("Maya audio response exceeded the 20 MB safety limit.", "AUDIO_TOO_LARGE");
      }
      return { audio, mimeType, locale };
    },
  });
}

export { MAYA_LANGUAGE_CODES };
