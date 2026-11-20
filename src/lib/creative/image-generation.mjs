export const MAX_IMAGE_PROMPT_LENGTH = 2048;
export const SUPPORTED_IMAGE_STEPS = Object.freeze([4, 8]);

export function parseImageGenerationInput(body) {
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > MAX_IMAGE_PROMPT_LENGTH) {
    return { ok: false, error: "Describe the image in 1–2,048 characters." };
  }

  const steps = body?.steps === undefined ? 4 : body.steps;
  if (!SUPPORTED_IMAGE_STEPS.includes(steps)) {
    return { ok: false, error: "Choose standard (4 steps) or enhanced detail (8 steps)." };
  }

  return { ok: true, prompt, steps };
}
