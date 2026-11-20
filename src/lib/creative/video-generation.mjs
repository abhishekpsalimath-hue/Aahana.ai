import { buildVideoPrompt, VIDEO_DIRECTOR_PRESETS } from "./creative-director.mjs";
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
