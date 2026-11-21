export const MAX_IMAGE_UPSCALE_INPUT_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_UPSCALE_OUTPUT_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_UPSCALE_MULTIPART_BYTES = MAX_IMAGE_UPSCALE_INPUT_BYTES + 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function readStreamWithinLimit(stream, maxBytes) {
  if (!stream || !Number.isInteger(maxBytes) || maxBytes < 1) return null;
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    try { await reader.cancel(); } catch {}
    return null;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export function detectImageMimeTypeFromBytes(bytes) {
  if (!(bytes instanceof Uint8Array)) return null;
  if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 &&
      String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export function validateImageUpscaleInput(bytes, declaredType) {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) return { ok: false, error: "Attach a non-empty image." };
  if (bytes.length > MAX_IMAGE_UPSCALE_INPUT_BYTES) return { ok: false, error: "Images must be 20 MB or smaller." };
  if (!ALLOWED_IMAGE_TYPES.has(declaredType)) return { ok: false, error: "Use a PNG, JPEG, or WebP image." };
  if (detectImageMimeTypeFromBytes(bytes) !== declaredType) return { ok: false, error: "The image file does not match its file type." };
  return { ok: true, mimeType: declaredType };
}

export function getSafeImageUpscaleWorkerUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
    if (url.hostname === "localhost" || url.hostname.endsWith(".localhost") ||
        url.hostname === "127.0.0.1" || url.hostname === "::1") return null;
    return url.toString();
  } catch {
    return null;
  }
}
