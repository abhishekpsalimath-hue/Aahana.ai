import { readBoundedRequestBody } from "../http/bounded-request-body.mjs";
import { parseImageEditInput, MAX_IMAGE_EDIT_BYTES, getReferenceImageDimensions, isReferenceImageWithinProviderBounds } from "./image-generation.mjs";

export const MAX_IMAGE_EDIT_REQUEST_BYTES = MAX_IMAGE_EDIT_BYTES + 64 * 1024;
const ALLOWED_FIELDS = new Set(["image", "prompt", "referencePrompt"]);

function isMultipartContentType(value) {
  return typeof value === "string" &&
    /^multipart\/form-data;\s*boundary=(?:"[^"]+"|[^;]+)$/i.test(value);
}

/**
 * Read and parse a tightly bounded reference-image edit request.
 * Reject duplicate and unexpected fields before any provider work begins.
 */
export async function readBoundedImageEditRequest(request) {
  if (!request || typeof request !== "object") {
    return { ok: false, status: 400, error: "Invalid image-edit request." };
  }
  if (request.signal?.aborted) {
    return { ok: false, status: 499, error: "Image editing cancelled." };
  }
  const contentType = request.headers?.get?.("content-type") || "";
  if (!isMultipartContentType(contentType)) {
    return { ok: false, status: 400, error: "Invalid image-edit request." };
  }

  const body = await readBoundedRequestBody(request, MAX_IMAGE_EDIT_REQUEST_BYTES);
  if (request.signal?.aborted) {
    return { ok: false, status: 499, error: "Image editing cancelled." };
  }
  if (!body.ok) {
    return {
      ok: false,
      status: body.reason === "too-large" ? 413 : 400,
      error: body.reason === "too-large"
        ? "The image-edit request exceeds the 2 MB image limit."
        : "Invalid image-edit request.",
    };
  }

  let form;
  try {
    form = await new Response(body.bytes, { headers: { "content-type": contentType } }).formData();
  } catch {
    return { ok: false, status: 400, error: "Invalid image-edit request." };
  }
  if (request.signal?.aborted) {
    return { ok: false, status: 499, error: "Image editing cancelled." };
  }

  const entries = [...form.entries()];
  if (entries.some(([key]) => !ALLOWED_FIELDS.has(key))) {
    return { ok: false, status: 400, error: "The image-edit request contains unsupported fields." };
  }
  for (const key of ALLOWED_FIELDS) {
    if (form.getAll(key).length > 1) {
      return { ok: false, status: 400, error: "The image-edit request contains duplicate fields." };
    }
  }

  const image = form.get("image");
  const prompt = form.get("prompt");
  const referencePrompt = form.get("referencePrompt");
  if (referencePrompt !== null &&
      (typeof referencePrompt !== "string" || referencePrompt.length > 1200)) {
    return { ok: false, status: 400, error: "The reference image context is too long." };
  }
  const input = parseImageEditInput({
    prompt,
    imageType: image?.type,
    imageSize: image?.size,
  });
  if (!input.ok || !image || typeof image.arrayBuffer !== "function") {
    return { ok: false, status: 400, error: input.error || "Attach a valid reference image." };
  }
  const imageBytes = new Uint8Array(await image.arrayBuffer());
  const dimensions = getReferenceImageDimensions(imageBytes, image.type);
  if (!isReferenceImageWithinProviderBounds(dimensions)) {
    return {
      ok: false,
      status: 400,
      error: "The reference image is invalid or must be smaller than 512 × 512 pixels.",
    };
  }

  return {
    ok: true,
    image,
    imageBytes,
    dimensions,
    prompt: input.prompt,
    referencePrompt: referencePrompt || "",
  };
}
