const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_OUTPUT_EDGE = 3840;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function jsonError(message, status) {
  return Response.json({ error: message }, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

function equalSecret(actual, expected) {
  if (typeof actual !== "string" || typeof expected !== "string" || actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

function hasValidSignature(bytes, mimeType) {
  if (mimeType === "image/png") {
    return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }
  if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/webp") {
    return bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP";
  }
  return false;
}

async function readLimitedBody(stream) {
  if (!stream) return null;
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return jsonError("Method not allowed.", 405);

    const expectedSecret = env.AAHANA_UPSCALE_SHARED_SECRET;
    const authorization = request.headers.get("Authorization") || "";
    const suppliedSecret = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!expectedSecret || !equalSecret(suppliedSecret, expectedSecret)) return jsonError("Unauthorized.", 401);

    if (!env.IMAGES || typeof env.IMAGES.input !== "function" || typeof env.IMAGES.info !== "function") {
      return jsonError("Image processing is not configured.", 503);
    }

    const declaredLength = Number(request.headers.get("Content-Length") || 0);
    if (declaredLength > MAX_IMAGE_BYTES) return jsonError("Image exceeds the 20 MB limit.", 413);

    const mimeType = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_TYPES.has(mimeType)) return jsonError("Only PNG, JPEG, and WebP images are supported.", 415);

    let bytes;
    try {
      bytes = await readLimitedBody(request.body);
    } catch {
      return jsonError("Could not read the image.", 400);
    }
    if (!bytes) return jsonError("Image is empty or exceeds the 20 MB limit.", 413);
    if (bytes.byteLength === 0) return jsonError("Image is empty.", 400);
    if (!hasValidSignature(bytes, mimeType)) return jsonError("Image content does not match its file type.", 415);

    try {
      const info = await env.IMAGES.info(bytes);
      if (!Number.isInteger(info?.width) || !Number.isInteger(info?.height) || info.width < 1 || info.height < 1) {
        return jsonError("Image dimensions could not be read.", 415);
      }
      const scale = Math.max(1, MAX_OUTPUT_EDGE / Math.max(info.width, info.height));
      const width = Math.max(info.width, Math.round(info.width * scale));
      const height = Math.max(info.height, Math.round(info.height * scale));
      const result = await env.IMAGES.input(bytes)
        .transform({
          width,
          height,
          fit: { mode: "contain", upscale: "generate" },
        })
        .output({ format: "image/png" });

      const response = await result.response({
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
      if (!response.ok) return jsonError("Image enhancement failed.", 502);
      return response;
    } catch {
      return jsonError("Image enhancement is temporarily unavailable.", 502);
    }
  },
};

export { MAX_IMAGE_BYTES, hasValidSignature, readLimitedBody };