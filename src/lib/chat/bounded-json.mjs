function requestError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function readBoundedJson(request, maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError("A positive byte limit is required.");
  }
  const declaredLength = request.headers?.get?.("content-length") ?? null;
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength)) throw requestError("Invalid request.", 400);
    if (Number(declaredLength) > maxBytes) {
      throw requestError("Request body is too large.", 413);
    }
  }
  const reader = request.body?.getReader?.();
  if (!reader) throw requestError("Invalid request.", 400);
  const decoder = new TextDecoder();
  let text = "";
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
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } catch (error) {
    if (error?.status) throw error;
    throw requestError("Invalid request.", 400);
  }
}
