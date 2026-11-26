export const MAX_REFERENCE_IMAGE_EDGE = 511;
export const MAX_REFERENCE_IMAGE_BYTES = 2 * 1024 * 1024;
const SUPPORTED_REFERENCE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function createReferenceImageFile(dataUrl, {
  ImageCtor = Image,
  documentRef,
  fetchImpl = fetch,
  FileCtor = File,
} = {}) {
  if (typeof dataUrl !== "string" || !/^data:image\/(?:png|jpeg|webp);base64,/.test(dataUrl)) {
    throw new Error("Could not read the reference image.");
  }

  const sourceResponse = await fetchImpl(dataUrl);
  if (!sourceResponse.ok) throw new Error("Could not read the reference image.");
  const sourceBlob = await sourceResponse.blob();
  if (!SUPPORTED_REFERENCE_TYPES.has(sourceBlob.type)) {
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
  const canvas = (documentRef ?? document).createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare the reference image.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve, reject) => canvas.toBlob(
    (value) => value ? resolve(value) : reject(new Error("Could not prepare the reference image.")),
    "image/jpeg",
    0.92
  ));
  if (!blob || blob.size < 1 || blob.size > MAX_REFERENCE_IMAGE_BYTES) {
    throw new Error("The reference image is too large to prepare. Please use a smaller image.");
  }
  return new FileCtor([blob], "aahana-reference.jpg", { type: "image/jpeg" });
}
