function requestError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function readBoundedMultipartFormData(request, maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError("A positive byte limit is required.");
  }

  const contentType = request.headers?.get?.("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(contentType) || !/\bboundary=(?:"[^"]+"|[^;\s]+)/i.test(contentType)) {
    throw requestError("Invalid multipart request.", 400);
  }

  const declaredLength = request.headers?.get?.("content-length") ?? null;
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength)) throw requestError("Invalid request.", 400);
    if (Number(declaredLength) > maxBytes) throw requestError("Request body is too large.", 413);
  }

  const reader = request.body?.getReader?.();
  if (!reader) throw requestError("Invalid request body.", 400);

  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw requestError("Invalid request body.", 400);
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => {});
        throw requestError("Request body is too large.", 413);
      }
      chunks.push(value);
    }

    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return await new Response(body, { headers: { "content-type": contentType } }).formData();
  } catch (error) {
    if (error?.status) throw error;
    throw requestError("Invalid multipart request.", 400);
  }
}
