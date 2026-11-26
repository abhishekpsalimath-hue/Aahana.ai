import { buildImagePrompt, buildImageSeriesPrompt, IMAGE_QUALITY_PRESETS } from "./creative-director.mjs";
export const MAX_IMAGE_PROMPT_LENGTH = 2048;
export const SUPPORTED_IMAGE_STEPS = Object.freeze([4, 8]);
export const IMAGE_ASPECT_RATIOS = Object.freeze({
  "1:1": Object.freeze({ width: 1024, height: 1024 }),
  "3:4": Object.freeze({ width: 768, height: 1024 }),
  "4:3": Object.freeze({ width: 1024, height: 768 }),
  "16:9": Object.freeze({ width: 1024, height: 576 }),
});

const IMAGE_STYLE_PROMPTS = Object.freeze({
  cinematic: "Cinematic visual style, intentional composition, atmospheric depth, nuanced color grading, and dramatic but natural lighting.",
  photorealistic: "Photorealistic visual treatment, physically plausible materials, natural detail, balanced exposure, and realistic lighting.",
  "3d-render": "High-quality 3D render, dimensional forms, physically based materials, refined textures, realistic reflections, and studio lighting.",
  "product-studio": "Premium commercial product photography, clean studio setup, precise product presentation, controlled softbox lighting, and crisp detail.",
  illustration: "Polished digital illustration, deliberate shapes, cohesive color palette, expressive detail, and clean visual hierarchy.",
  editorial: "Premium editorial art direction, thoughtful negative space, refined composition, sophisticated typography-safe layout, and balanced lighting.",
});


export function inferImageAspectRatio(prompt) {
  const text = typeof prompt === "string" ? prompt.toLowerCase() : "";
  // An explicit numeric ratio always outranks descriptive orientation words.
  if (/\b16\s*:\s*9\b/.test(text)) return "16:9";
  if (/\b4\s*:\s*3\b/.test(text)) return "4:3";
  if (/\b3\s*:\s*4\b/.test(text)) return "3:4";
  if (/\b(widescreen|wide\s+landscape|cinematic\s+landscape)\b|वाइडस्क्रीन|चौड़ी\s+स्क्रीन|ವೈಡ್‌ಸ್ಕ್ರೀನ್|ವಿಶಾಲ\s+ಪರದೆ/u.test(text)) return "16:9";
  if (/\b(landscape|horizontal)\b|क्षैतिज|आड़ा\s+दृश्य|ಅಡ್ಡ(?:ವಾದ|ವಾಗಿ)?(?:\s*ಚಿತ್ರ)?/u.test(text)) return "4:3";
  if (/\b(portrait|vertical|phone\s+wallpaper)\b|लंबवत|ऊर्ध्वाधर|वर्टिकल|फोन\s+वॉलपेपर|ಲಂಬ(?:ವಾದ|ವಾಗಿ)?(?:\s*ಚಿತ್ರ)?|ಮೊಬೈಲ್\s+ವಾಲ್‌ಪೇಪರ್/u.test(text)) return "3:4";
  return "1:1";
}

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

  const aspectRatio = body?.aspectRatio === undefined ? inferImageAspectRatio(prompt) : body.aspectRatio;
  if (!Object.hasOwn(IMAGE_ASPECT_RATIOS, aspectRatio)) {
    return { ok: false, error: "Choose a supported image aspect ratio." };
  }
  const { width, height } = IMAGE_ASPECT_RATIOS[aspectRatio];

  const style = body?.style === undefined ? "none" : body.style;
  if (style !== "none" && !Object.hasOwn(IMAGE_STYLE_PROMPTS, style)) {
    return { ok: false, error: "Choose a supported visual style." };
  }

  const qualityPrompt = buildImagePrompt(prompt, quality);
  const seriesPrompt = buildImageSeriesPrompt(qualityPrompt, body?.series);
  if (seriesPrompt === null) return { ok: false, error: "Check the image-series fields: use text up to 180 characters and a scene number from 1 to 12." };
  const styledPrompt = style === "none" ? seriesPrompt : `${seriesPrompt}\n\nArt direction: ${IMAGE_STYLE_PROMPTS[style]}`;
  if (styledPrompt.length > MAX_IMAGE_PROMPT_LENGTH + 4600) {
    return { ok: false, error: "This prompt is too long for the selected style. Shorten it and try again." };
  }

  return { ok: true, prompt: styledPrompt, steps, style, quality, aspectRatio, width, height };
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
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a &&
      bytes[8] === 0x00 && bytes[9] === 0x00 && bytes[10] === 0x00 && bytes[11] === 0x0d &&
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

export const MAX_REFERENCE_IMAGE_PIXELS = 40_000_000;
export const MAX_REFERENCE_IMAGE_EDGE = 12_000;

export function isImageWithinPixelBounds(dimensions, maxPixels = MAX_REFERENCE_IMAGE_PIXELS, maxEdge = MAX_REFERENCE_IMAGE_EDGE) {
  if (!dimensions || !Number.isSafeInteger(dimensions.width) || !Number.isSafeInteger(dimensions.height) ||
      dimensions.width < 1 || dimensions.height < 1 ||
      !Number.isSafeInteger(maxPixels) || maxPixels < 1 ||
      !Number.isSafeInteger(maxEdge) || maxEdge < 1) return false;
  if (dimensions.width > maxEdge || dimensions.height > maxEdge) return false;
  return dimensions.width * dimensions.height <= maxPixels;
}

export function isReferenceImageWithinProviderBounds(dimensions) {
  return Boolean(dimensions && Number.isInteger(dimensions.width) && Number.isInteger(dimensions.height) &&
    dimensions.width > 0 && dimensions.height > 0 && dimensions.width < 512 && dimensions.height < 512);
}


export function getReferenceImageOutputDimensions(dimensions) {
  if (!dimensions || !Number.isInteger(dimensions.width) || !Number.isInteger(dimensions.height) ||
      dimensions.width < 1 || dimensions.height < 1) return null;

  const longest = Math.max(dimensions.width, dimensions.height);
  const shortest = Math.min(dimensions.width, dimensions.height);
  // FLUX.2 Klein accepts output edges from 256px to 1920px. Aim for a
  // 1024px long edge, but enlarge narrow references enough to meet the
  // provider minimum without changing their aspect ratio.
  let scale = 1024 / longest;
  if (shortest * scale < 256) scale = 256 / shortest;
  if (longest * scale > 1920) return null;

  return {
    width: Math.max(256, Math.min(1920, Math.round(dimensions.width * scale))),
    height: Math.max(256, Math.min(1920, Math.round(dimensions.height * scale))),
  };
}

export function getGeneratedImageFileMetadata(dataUrl, blobType) {
  const match = typeof dataUrl === "string" ? dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,/i) : null;
  const mimeType = match?.[1]?.toLowerCase();
  const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : mimeType === "image/jpeg" ? "jpg" : null;
  if (!mimeType || !extension || blobType !== mimeType) return null;
  return { mimeType, extension };
}
