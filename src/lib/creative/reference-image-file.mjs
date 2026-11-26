export const MAX_REFERENCE_IMAGE_EDGE = 511;
export const MAX_REFERENCE_IMAGE_BYTES = 2 * 1024 * 1024;
const SUPPORTED_REFERENCE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function createReferenceImageFile(dataUrl, {
  ImageCtor = globalThis.Image,
  documentRef = globalThis.document,
  fetchImpl = globalThis.fetch,
  FileCtor = globalThis.File,
} = {}) {
  if (typeof dataUrl !== "string") {
    throw new Error("Could not read the reference image.");
  }
  const dataUrlMatch = dataUrl.match(/^data:(image\/[^;,]+);base64,/);
  if (!dataUrlMatch) throw new Error("Could not read the reference image.");
  if (!SUPPORTED_REFERENCE_TYPES.has(dataUrlMatch[1])) {
    throw new Error("Attach a PNG, JPEG or WebP reference image.");
  }

  const sourceResponse = await fetchImpl(dataUrl);
  if (!sourceResponse.ok) throw new Error("Could not read the reference image.");
  const sourceBlob = await sourceResponse.blob();
  if (!SUPPORTED_REFERENCE_TYPES.has(sourceBlob.type) || sourceBlob.type !== dataUrlMatch[1]) {
    throw new Error("Attach a PNG, JPEG or WebP reference image.");
  }

  const image = new ImageCtor();
  image.src = dataUrl;
  await image.decode();
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error("The reference image has invalid dimensions.");
  }
  const longestEdge = Math.max(width, height);

  if (longestEdge <= MAX_REFERENCE_IMAGE_EDGE &&
      sourceBlob.size > 0 && sourceBlob.size <= MAX_REFERENCE_IMAGE_BYTES) {
    // Preserve original bytes for small references; avoid unnecessary JPEG loss.
    return new FileCtor([sourceBlob], "aahana-reference", { type: sourceBlob.type });
  }

  const scale = Math.min(1, MAX_REFERENCE_IMAGE_EDGE / longestEdge);
  const canvas = (documentRef ?? globalThis.document).createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare the reference image.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const encode = (type, quality) => new Promise((resolve, reject) => canvas.toBlob(
    (value) => value ? resolve(value) : reject(new Error("Could not prepare the reference image.")),
    type,
    quality
  ));
  let blob = await encode(sourceBlob.type, sourceBlob.type === "image/jpeg" ? 0.92 : undefined);
  if (!SUPPORTED_REFERENCE_TYPES.has(blob.type) || blob.size < 1 || blob.size > MAX_REFERENCE_IMAGE_BYTES) {
    if (sourceBlob.type !== "image/jpeg") blob = await encode("image/jpeg", 0.92);
  }
  if (!SUPPORTED_REFERENCE_TYPES.has(blob.type) || blob.size < 1 || blob.size > MAX_REFERENCE_IMAGE_BYTES) {
    throw new Error("The reference image is too large to prepare. Please use a smaller image.");
  }
  const extension = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  return new FileCtor([blob], "aahana-reference." + extension, { type: blob.type });
}
