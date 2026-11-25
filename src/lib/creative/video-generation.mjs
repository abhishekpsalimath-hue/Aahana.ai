import { buildVideoPrompt, VIDEO_DIRECTOR_PRESETS } from "./creative-director.mjs";
import { getReferenceImageDimensions } from "./image-generation.mjs";
export const VIDEO_MODEL = "xai/grok-imagine-video";
export const MAX_VIDEO_PROMPT_LENGTH = 2000;
export const MAX_VIDEO_DURATION_SECONDS = 15;
export const VIDEO_ASPECT_RATIOS = Object.freeze(["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"]);
export const VIDEO_RESOLUTIONS = Object.freeze(["480p", "720p"]);

export function parseVideoGenerationInput(body) {
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > MAX_VIDEO_PROMPT_LENGTH) {
    return { ok: false, error: "Describe the video in 1–2,000 characters." };
  }

  const duration = body?.duration === undefined ? 5 : body.duration;
  if (!Number.isInteger(duration) || duration < 1 || duration > MAX_VIDEO_DURATION_SECONDS) {
    return { ok: false, error: "Video duration must be between 1 and 15 seconds." };
  }

  const aspectRatio = body?.aspectRatio === undefined ? "16:9" : body.aspectRatio;
  if (!VIDEO_ASPECT_RATIOS.includes(aspectRatio)) {
    return { ok: false, error: "Choose a supported video aspect ratio." };
  }

  const resolution = body?.resolution === undefined ? "480p" : body.resolution;
  if (!VIDEO_RESOLUTIONS.includes(resolution)) {
    return { ok: false, error: "Choose 480p or 720p video resolution." };
  }

  const director = body?.director === undefined ? "cinematic" : body.director;
  if (!VIDEO_DIRECTOR_PRESETS.includes(director)) {
    return { ok: false, error: "Choose a supported video direction." };
  }
  const directedPrompt = buildVideoPrompt(prompt, director);
  if (!directedPrompt || directedPrompt.length > MAX_VIDEO_PROMPT_LENGTH) {
    return { ok: false, error: "This video prompt is too long for the selected direction. Shorten it and try again." };
  }

  return { ok: true, prompt: directedPrompt, duration, aspectRatio, resolution, director };
}


export const MAX_VIDEO_REFERENCE_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_VIDEO_REFERENCE_IMAGE_DIMENSION = 4096;
export const MAX_VIDEO_REFERENCE_IMAGE_PIXELS = 16777216;
const VIDEO_REFERENCE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function validateVideoReferenceImage({ bytes, imageType, imageSize } = {}) {
  if (!VIDEO_REFERENCE_IMAGE_TYPES.has(imageType) || !Number.isInteger(imageSize) || imageSize < 1 || imageSize > MAX_VIDEO_REFERENCE_IMAGE_BYTES) return { ok: false, error: "Choose a valid PNG, JPEG or WebP reference image up to 2 MB." };
  const dimensions = getReferenceImageDimensions(bytes, imageType);
  if (!dimensions || !Number.isInteger(dimensions.width) || !Number.isInteger(dimensions.height) || dimensions.width < 1 || dimensions.height < 1 || dimensions.width > MAX_VIDEO_REFERENCE_IMAGE_DIMENSION || dimensions.height > MAX_VIDEO_REFERENCE_IMAGE_DIMENSION || dimensions.width * dimensions.height > MAX_VIDEO_REFERENCE_IMAGE_PIXELS) return { ok: false, error: "The reference image is invalid or exceeds the 4,096-pixel / 16-megapixel limit." };
  return { ok: true, dimensions };
}
