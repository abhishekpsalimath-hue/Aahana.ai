export const DEFAULT_IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";
export const ENHANCED_IMAGE_MODEL = "@cf/black-forest-labs/flux-2-klein-4b";
export const ACCURACY_IMAGE_MODEL = "@cf/black-forest-labs/flux-2-dev";

export function getImageOutputMimeType(model) {
  return model === ENHANCED_IMAGE_MODEL || model === ACCURACY_IMAGE_MODEL ? "image/png" : "image/jpeg";
}

export function detectImageMimeTypeFromBase64(value) {
  if (typeof value !== "string" || value.length < 16 || value.length > 24 * 1024 * 1024) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  const unpadded = value.replace(/=+$/, "");
  if (unpadded.length % 4 === 1 || (value.includes("=") && value.length % 4 !== 0)) return null;

  const bytes = Buffer.from(value, "base64");
  if (!bytes.length || bytes.toString("base64").replace(/=+$/, "") !== unpadded) return null;

  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

export function resolveImageModel(value) {
  if (value === "flux-2-klein-4b") return ENHANCED_IMAGE_MODEL;
  if (value === "flux-2-dev") return ACCURACY_IMAGE_MODEL;
  return DEFAULT_IMAGE_MODEL;
}

export function buildImageProviderRequest({ model, prompt, steps = 8, seed, width = 1024, height = 1024 }) {
  if (model === ENHANCED_IMAGE_MODEL || model === ACCURACY_IMAGE_MODEL) {
    const body = new FormData();
    body.set("prompt", prompt);
    body.set("width", String(width));
    body.set("height", String(height));
    if (model === ACCURACY_IMAGE_MODEL) {
      body.set("steps", "25");
      body.set("guidance", "4");
      if (Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff) body.set("seed", String(seed));
    }
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
    body: JSON.stringify({ prompt, steps, width, height }),
    cache: "no-store",
    signal: AbortSignal.timeout(55000),
  };
}
