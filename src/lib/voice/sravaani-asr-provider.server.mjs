import { SpeechProviderError, normalizeLocale } from "./speech-runtime.mjs";

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

/**
 * Server-only adapter for Aahana's private SraVaani HTTP wrapper.
 *
 * Inject endpoint, bearer token and the exact locale allow-list from trusted
 * server-side configuration. The model itself performs language recognition;
 * the locale is used here as Aahana's requested/expected locale metadata.
 */
export function createSraVaaniAsrProvider({
  baseUrl,
  authorizationToken = "",
  supportedLocales = [],
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof window !== "undefined") {
    throw new SpeechProviderError(
      "SraVaani credentials and endpoint must only be used server-side.",
      "SERVER_ONLY_PROVIDER",
    );
  }

  const normalizedBaseUrl = typeof baseUrl === "string"
    ? baseUrl.trim().replace(/\/+$/, "")
    : "";
  let parsedUrl = null;

  if (normalizedBaseUrl) {
    try {
      parsedUrl = new URL(normalizedBaseUrl);
    } catch {
      throw new SpeechProviderError("SraVaani endpoint must be a valid URL.", "INVALID_PROVIDER_CONFIG");
    }
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(parsedUrl.hostname);
    if (parsedUrl.protocol !== "https:" && !(parsedUrl.protocol === "http:" && loopback)) {
      throw new SpeechProviderError("SraVaani endpoint must use HTTPS unless it is loopback.", "INSECURE_PROVIDER_ENDPOINT");
    }
  }

  if (typeof fetchImpl !== "function") {
    throw new SpeechProviderError("A fetch implementation is required.", "INVALID_PROVIDER_CONFIG");
  }
  if (parsedUrl && (typeof authorizationToken !== "string" || authorizationToken.length < 32)) {
    throw new SpeechProviderError("A private SraVaani bearer token of at least 32 characters is required.", "INVALID_PROVIDER_CONFIG");
  }
  if (!Array.isArray(supportedLocales) || supportedLocales.length === 0) {
    throw new SpeechProviderError("Provide an explicit, tested SraVaani locale allow-list.", "INVALID_PROVIDER_CONFIG");
  }

  const canonicalLocales = [...new Set(supportedLocales.map(normalizeLocale))];

  return Object.freeze({
    id: "sravaani-1.0",
    supportedLocales: canonicalLocales,
    isAvailable: () => Boolean(parsedUrl && authorizationToken),
    async transcribe({ audio, locale, signal }) {
      if (!parsedUrl || !authorizationToken) {
        throw new SpeechProviderError("SraVaani endpoint is not configured.", "PROVIDER_UNAVAILABLE");
      }
      const requestedLocale = normalizeLocale(locale);
      if (!canonicalLocales.includes(requestedLocale)) {
        throw new SpeechProviderError(`SraVaani is not enabled for ${requestedLocale} in this deployment.`, "UNSUPPORTED_LOCALE");
      }

      let audioBlob;
      if (audio instanceof Blob) {
        audioBlob = audio;
      } else if (audio instanceof ArrayBuffer || ArrayBuffer.isView(audio)) {
        const bytes = audio instanceof ArrayBuffer
          ? new Uint8Array(audio)
          : new Uint8Array(audio.buffer, audio.byteOffset, audio.byteLength);
        audioBlob = new Blob([bytes], { type: "audio/wav" });
      } else {
        throw new SpeechProviderError("SraVaani requires WAV audio bytes.", "INVALID_AUDIO");
      }

      if (!audioBlob.size || audioBlob.size > MAX_AUDIO_BYTES) {
        throw new SpeechProviderError("WAV audio must be between 1 byte and 15 MB.", "INVALID_AUDIO_SIZE");
      }
      if (audioBlob.type && audioBlob.type !== "audio/wav" && audioBlob.type !== "audio/x-wav") {
        throw new SpeechProviderError("SraVaani accepts WAV audio only.", "INVALID_AUDIO");
      }

      const form = new FormData();
      form.append("file", audioBlob, "speech.wav");

      let response;
      try {
        response = await fetchImpl(new URL("/v1/audio/transcriptions", parsedUrl), {
          method: "POST",
          headers: { Authorization: `Bearer ${authorizationToken}` },
          body: form,
          signal,
        });
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        throw new SpeechProviderError("Could not reach the private SraVaani service.", "PROVIDER_CONNECTION_FAILED");
      }

      if (!response.ok) {
        throw new SpeechProviderError(`SraVaani service returned HTTP ${response.status}.`, "PROVIDER_REQUEST_FAILED");
      }
      const contentType = String(response.headers?.get?.("content-type") || "").toLowerCase();
      if (!contentType.includes("application/json")) {
        throw new SpeechProviderError("SraVaani returned an unexpected response type.", "INVALID_PROVIDER_RESPONSE");
      }
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new SpeechProviderError("SraVaani returned invalid JSON.", "INVALID_PROVIDER_RESPONSE");
      }
      if (typeof payload?.text !== "string" || !payload.text.trim()) {
        throw new SpeechProviderError("SraVaani returned no transcript.", "EMPTY_TRANSCRIPT");
      }
      return { text: payload.text.trim(), locale: requestedLocale };
    },
  });
}
