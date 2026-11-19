/**
 * Provider-neutral speech runtime for Aahana.
 *
 * Providers are injected explicitly by trusted server/client composition code.
 * This module never discovers credentials, enables a paid provider, uploads
 * audio, or chooses a provider implicitly.
 */

export const DEFAULT_PROVIDER_TIMEOUT_MS = 45_000;

/**
 * Bound an upstream speech request while preserving caller cancellation.
 * A caller abort remains distinguishable from the provider deadline.
 */
export function createProviderRequestSignal(signal, timeoutMs = DEFAULT_PROVIDER_TIMEOUT_MS) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) {
    throw new SpeechProviderError("Provider timeout must be between 1 and 120,000 ms.", "INVALID_PROVIDER_TIMEOUT");
  }
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

export function isProviderTimeout(error, requestSignal, callerSignal) {
  return Boolean(
    requestSignal?.aborted &&
    !callerSignal?.aborted &&
    requestSignal.reason?.name === "TimeoutError"
  );
}

export class SpeechProviderError extends Error {
  constructor(message, code = "SPEECH_PROVIDER_ERROR") {
    super(message);
    this.name = "SpeechProviderError";
    this.code = code;
  }
}

function normalizeLocale(locale) {
  if (typeof locale !== "string" || !locale.trim()) {
    throw new SpeechProviderError("A speech locale is required.", "INVALID_LOCALE");
  }
  try {
    return Intl.getCanonicalLocales(locale.trim())[0];
  } catch {
    throw new SpeechProviderError("The requested speech locale is invalid.", "INVALID_LOCALE");
  }
}

function supportsLocale(provider, locale) {
  const supported = Array.isArray(provider?.supportedLocales)
    ? provider.supportedLocales
    : [];
  const requested = normalizeLocale(locale).toLowerCase();
  return supported.some((candidate) => {
    try {
      return normalizeLocale(candidate).toLowerCase() === requested;
    } catch {
      return false;
    }
  });
}

function validateProvider(provider, methodName, kind) {
  if (!provider) return null;
  if (typeof provider.id !== "string" || !provider.id.trim()) {
    throw new SpeechProviderError(`The ${kind} provider must have an id.`, "INVALID_PROVIDER");
  }
  if (typeof provider[methodName] !== "function") {
    throw new SpeechProviderError(`The ${kind} provider does not implement ${methodName}().`, "INVALID_PROVIDER");
  }
  return provider;
}

export function createSpeechRuntime({
  recognitionProvider = null,
  synthesisProvider = null,
} = {}) {
  const recognition = validateProvider(recognitionProvider, "transcribe", "recognition");
  const synthesis = validateProvider(synthesisProvider, "synthesize", "synthesis");

  return Object.freeze({
    getCapabilities() {
      return Object.freeze({
        recognition: recognition ? {
          providerId: recognition.id,
          enabled: typeof recognition.isAvailable === "function" ? Boolean(recognition.isAvailable()) : true,
          supportedLocales: [...(recognition.supportedLocales || [])],
        } : { providerId: null, enabled: false, supportedLocales: [] },
        synthesis: synthesis ? {
          providerId: synthesis.id,
          enabled: typeof synthesis.isAvailable === "function" ? Boolean(synthesis.isAvailable()) : true,
          supportedLocales: [...(synthesis.supportedLocales || [])],
        } : { providerId: null, enabled: false, supportedLocales: [] },
      });
    },

    async transcribe({ audio, locale, signal } = {}) {
      if (!recognition) throw new SpeechProviderError("No speech-recognition provider is configured.", "PROVIDER_NOT_CONFIGURED");
      if (typeof recognition.isAvailable === "function" && !recognition.isAvailable()) {
        throw new SpeechProviderError("The configured speech-recognition provider is unavailable.", "PROVIDER_UNAVAILABLE");
      }
      const normalizedLocale = normalizeLocale(locale);
      if (!supportsLocale(recognition, normalizedLocale)) {
        throw new SpeechProviderError(`The recognition provider does not support ${normalizedLocale}.`, "UNSUPPORTED_LOCALE");
      }
      if (audio == null) throw new SpeechProviderError("Audio input is required.", "AUDIO_REQUIRED");
      const result = await recognition.transcribe({ audio, locale: normalizedLocale, signal });
      if (!result || typeof result.text !== "string" || !result.text.trim()) {
        throw new SpeechProviderError("The recognition provider returned no transcript.", "EMPTY_TRANSCRIPT");
      }
      return { text: result.text.trim(), locale: result.locale || normalizedLocale, providerId: recognition.id };
    },

    async synthesize({ text, locale, signal } = {}) {
      if (!synthesis) throw new SpeechProviderError("No speech-synthesis provider is configured.", "PROVIDER_NOT_CONFIGURED");
      if (typeof synthesis.isAvailable === "function" && !synthesis.isAvailable()) {
        throw new SpeechProviderError("The configured speech-synthesis provider is unavailable.", "PROVIDER_UNAVAILABLE");
      }
      if (typeof text !== "string" || !text.trim()) {
        throw new SpeechProviderError("Text to speak is required.", "TEXT_REQUIRED");
      }
      const normalizedLocale = normalizeLocale(locale);
      if (!supportsLocale(synthesis, normalizedLocale)) {
        throw new SpeechProviderError(`The synthesis provider does not support ${normalizedLocale}.`, "UNSUPPORTED_LOCALE");
      }
      const result = await synthesis.synthesize({ text: text.trim(), locale: normalizedLocale, signal });
      if (!result || result.audio == null) {
        throw new SpeechProviderError("The synthesis provider returned no audio.", "EMPTY_AUDIO");
      }
      return { audio: result.audio, mimeType: result.mimeType || "audio/mpeg", locale: result.locale || normalizedLocale, providerId: synthesis.id };
    },
  });
}

export { normalizeLocale };
