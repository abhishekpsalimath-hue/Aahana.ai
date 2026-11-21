export const DEFAULT_IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";
export const ENHANCED_IMAGE_MODEL = "@cf/black-forest-labs/flux-2-klein-4b";
export function getImageOutputMimeType(model) {
  return model === ENHANCED_IMAGE_MODEL ? "image/png" : "image/jpeg";
}

export function resolveImageModel(value) {
  return value === "flux-2-klein-4b" ? ENHANCED_IMAGE_MODEL : DEFAULT_IMAGE_MODEL;
}

export function buildImageProviderRequest({ model, prompt, steps = 8 }) {
  if (model === ENHANCED_IMAGE_MODEL) {
    const body = new FormData();
    body.set("prompt", prompt);
    body.set("width", "1024");
    body.set("height", "1024");
    return {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(55000),
    };
  }

  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, steps }),
    cache: "no-store",
    signal: AbortSignal.timeout(55000),
  };
}
