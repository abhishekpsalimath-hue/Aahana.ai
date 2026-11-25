export const MAX_IMAGE_GENERATION_REQUEST_BYTES = 16 * 1024;

export async function readBoundedImageGenerationJson(request, maxBytes = MAX_IMAGE_GENERATION_REQUEST_BYTES) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    return { ok: false, status: 500, error: "Invalid request limit." };
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\\d+$/.test(declaredLength)) {
      return { ok: false, status: 400, error: "Invalid request size." };
    }
    if (Number(declaredLength) > maxBytes) {
      return { ok: false, status: 413, error: "Image-generation request is too large." };
    }
  }

  if (!request.body) return { ok: false, status: 400, error: "Invalid request." };

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) {
        await reader.cancel("Invalid request stream.");
        return { ok: false, status: 400, error: "Invalid request." };
      }
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("Request size limit exceeded.");
        return { ok: false, status: 413, error: "Image-generation request is too large." };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400, error: "Could not read the request." };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, status: 400, error: "Invalid request." };
    }
    return { ok: true, value };
  } catch {
    return { ok: false, status: 400, error: "Invalid request." };
  }
}

export const MAX_IMAGE_PROVIDER_RESPONSE_BYTES = 25 * 1024 * 1024;

export async function readBoundedImageProviderJson(response, maxBytes = MAX_IMAGE_PROVIDER_RESPONSE_BYTES) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    return { ok: false, error: "Invalid response limit." };
  }
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\\d+$/.test(declaredLength) || Number(declaredLength) > maxBytes) {
      await response.body?.cancel("Provider response exceeds the allowed size.").catch(() => {});
      return { ok: false, error: "Provider response is too large or invalid." };
    }
  }
  if (!response.body) return { ok: false, error: "Provider returned an empty response." };

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("Provider response size limit exceeded.");
        return { ok: false, error: "Provider response is too large." };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, error: "Could not read provider response." };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "Invalid provider response." };
    return { ok: true, value };
  } catch {
    return { ok: false, error: "Invalid provider response." };
  }
}
