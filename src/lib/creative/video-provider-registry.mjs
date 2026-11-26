/**
 * Provider-neutral capability registry for Aahana video generation.
 * Only providers with a verified adapter are listed as available.
 * This registry does not activate paid inference or choose a provider by itself.
 */
export const VIDEO_PROVIDER_IDS = Object.freeze({
  CLOUDFLARE_GROK_IMAGINE: "cloudflare-grok-imagine-video",
});

const PROVIDERS = Object.freeze([
  Object.freeze({
    id: VIDEO_PROVIDER_IDS.CLOUDFLARE_GROK_IMAGINE,
    label: "Grok Imagine Video (Cloudflare AI)",
    adapter: "cloudflare-ai-run",
    model: "xai/grok-imagine-video",
    availability: "implemented",
    capabilities: Object.freeze({
      textToVideo: true,
      imageToVideo: true,
      referenceImages: true,
      multiShotNative: false,
      maxDurationSeconds: 15,
      resolutions: Object.freeze(["480p", "720p"]),
      aspectRatios: Object.freeze(["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"]),
      audioGeneration: false,
      voiceover: false,
      captions: false,
    }),
  }),
]);

const PROVIDER_BY_ID = new Map(PROVIDERS.map((provider) => [provider.id, provider]));

export function listVideoProviders() {
  return PROVIDERS.map((provider) => ({
    ...provider,
    capabilities: { ...provider.capabilities, resolutions: [...provider.capabilities.resolutions], aspectRatios: [...provider.capabilities.aspectRatios] },
  }));
}

/** Resolve only an implemented adapter. Unknown or unconfigured providers fail closed. */
export function resolveVideoProvider(providerId) {
  const id = providerId === undefined || providerId === null || providerId === ""
    ? VIDEO_PROVIDER_IDS.CLOUDFLARE_GROK_IMAGINE
    : providerId;
  if (typeof id !== "string") return { ok: false, error: "Video provider id must be a string." };
  const provider = PROVIDER_BY_ID.get(id);
  if (!provider || provider.availability !== "implemented") {
    return { ok: false, error: "The requested video provider is not implemented or enabled." };
  }
  return { ok: true, provider };
}

/** Check requested settings against declared provider capabilities before an API call. */
export function validateVideoProviderRequest(provider, { prompt, duration, aspectRatio, resolution, hasReferenceImage = false } = {}) {
  if (!provider || provider.availability !== "implemented") return { ok: false, error: "Video provider is unavailable." };
  const capabilities = provider.capabilities;
  if (typeof prompt !== "string" || !prompt.trim()) return { ok: false, error: "A video prompt is required." };
  if (!Number.isInteger(duration) || duration < 1 || duration > capabilities.maxDurationSeconds) return { ok: false, error: "The selected provider does not support this video duration." };
  if (!capabilities.aspectRatios.includes(aspectRatio)) return { ok: false, error: "The selected provider does not support this aspect ratio." };
  if (!capabilities.resolutions.includes(resolution)) return { ok: false, error: "The selected provider does not support this resolution." };
  if (hasReferenceImage && !capabilities.imageToVideo) return { ok: false, error: "The selected provider does not support image-to-video." };
  return { ok: true };
}
