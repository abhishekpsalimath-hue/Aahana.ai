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
  if (styledPrompt.length > MAX_IMAGE_PROMPT_LENGTH + 1400) {
    return { ok: false, error: "This prompt is too long for the selected style. Shorten it and try again." };
  }

  return { ok: true, prompt: styledPrompt, steps, style, quality };
}


export const MAX_IMAGE_EDIT_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_EDIT_PROMPT_LENGTH = 1400;
export const SUPPORTED_IMAGE_EDIT_TYPES = Object.freeze([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export function parseImageEditInput({ prompt, imageType, imageSize } = {}) {
  const normalizedPrompt = typeof prompt === "string" ? prompt.trim() : "";
  if (!normalizedPrompt || normalizedPrompt.length > MAX_IMAGE_EDIT_PROMPT_LENGTH) {
    return { ok: false, error: "Describe the change in 1–1,400 characters." };
  }
  if (!SUPPORTED_IMAGE_EDIT_TYPES.includes(imageType)) {
    return { ok: false, error: "Attach a PNG, JPEG or WebP reference image." };
  }
  if (!Number.isInteger(imageSize) || imageSize < 1 || imageSize > MAX_IMAGE_EDIT_BYTES) {
    return { ok: false, error: "The reference image must be smaller than 2 MB." };
  }
  return { ok: true, prompt: normalizedPrompt };
}

export function getReferenceImageDimensions(input, imageType) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || []);
  if (imageType === "image/png" && bytes.length >= 33 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[12] === 0x49 && bytes[13] === 0x48 && bytes[14] === 0x44 && bytes[15] === 0x52) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  if (imageType === "image/jpeg" && bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      while (bytes[offset] === 0xff) offset += 1;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const length = (bytes[offset] << 8) | bytes[offset + 1];
      if (length < 2 || offset + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        if (length < 7) break;
        return { height: (bytes[offset + 3] << 8) | bytes[offset + 4], width: (bytes[offset + 5] << 8) | bytes[offset + 6] };
      }
      offset += length;
    }
  }

  if (imageType === "image/webp" && bytes.length >= 30 &&
      String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP") {
    const chunk = String.fromCharCode(...bytes.subarray(12, 16));
    if (chunk === "VP8X") {
      const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
      const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
      return { width, height };
    }
    if (chunk === "VP8 " && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      return { width: ((bytes[27] << 8) | bytes[26]) & 0x3fff, height: ((bytes[29] << 8) | bytes[28]) & 0x3fff };
    }
    if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
      return {
        width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
        height: 1 + ((bytes[22] >> 6) | (bytes[23] << 2) | ((bytes[24] & 0x0f) << 10)),
      };
    }
  }
  return null;
}

export function isReferenceImageWithinProviderBounds(dimensions) {
  return Boolean(dimensions && Number.isInteger(dimensions.width) && Number.isInteger(dimensions.height) &&
    dimensions.width > 0 && dimensions.height > 0 && dimensions.width < 512 && dimensions.height < 512);
}
