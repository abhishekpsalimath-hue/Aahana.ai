import { buildImagePrompt, IMAGE_QUALITY_PRESETS } from "./creative-director.mjs";
export const MAX_IMAGE_PROMPT_LENGTH = 2048;
export const SUPPORTED_IMAGE_STEPS = Object.freeze([4, 8]);

const IMAGE_STYLE_PROMPTS = Object.freeze({
  cinematic: "Cinematic visual style, intentional composition, atmospheric depth, nuanced color grading, and dramatic but natural lighting.",
  photorealistic: "Photorealistic visual treatment, physically plausible materials, natural detail, balanced exposure, and realistic lighting.",
  "3d-render": "High-quality 3D render, dimensional forms, physically based materials, refined textures, realistic reflections, and studio lighting.",
  "product-studio": "Premium commercial product photography, clean studio setup, precise product presentation, controlled softbox lighting, and crisp detail.",
  illustration: "Polished digital illustration, deliberate shapes, cohesive color palette, expressive detail, and clean visual hierarchy.",
  editorial: "Premium editorial art direction, thoughtful negative space, refined composition, sophisticated typography-safe layout, and balanced lighting.",
});

export function parseImageGenerationInput(body) {
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > MAX_IMAGE_PROMPT_LENGTH) {
    return { ok: false, error: "Describe the image in 1–2,048 characters." };
  }

  const steps = body?.steps === undefined ? 8 : body.steps;
  if (!SUPPORTED_IMAGE_STEPS.includes(steps)) {
    return { ok: false, error: "Choose standard (4 steps) or enhanced detail (8 steps)." };
  }

  const quality = body?.quality === undefined ? "masterpiece" : body.quality;
  if (!IMAGE_QUALITY_PRESETS.includes(quality)) {
    return { ok: false, error: "Choose standard or masterpiece image quality." };
  }

  const style = body?.style === undefined ? "none" : body.style;
  if (style !== "none" && !Object.hasOwn(IMAGE_STYLE_PROMPTS, style)) {
    return { ok: false, error: "Choose a supported visual style." };
  }

  const qualityPrompt = buildImagePrompt(prompt, quality);
  const styledPrompt = style === "none" ? qualityPrompt : `${qualityPrompt}\n\nArt direction: ${IMAGE_STYLE_PROMPTS[style]}`;
  if (styledPrompt.length > MAX_IMAGE_PROMPT_LENGTH) {
    return { ok: false, error: "This prompt is too long for the selected style. Shorten it and try again." };
  }

  return { ok: true, prompt: styledPrompt, steps, style, quality };
}
