export async function readBoundedRequestBody(request, maxBytes) {
  if (!Number.isInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError("maxBytes must be a positive integer.");
  }
  const declaredLength = request?.headers?.get?.("content-length");
  if (declaredLength !== null && declaredLength !== undefined) {
    if (!/^\d+$/.test(declaredLength)) return { ok: false, reason: "invalid" };
    if (Number(declaredLength) > maxBytes) return { ok: false, reason: "too-large" };
  }
  if (!request?.body || typeof request.body.getReader !== "function") {
    return { ok: false, reason: "invalid" };
  }

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) {
        await reader.cancel();
        return { ok: false, reason: "invalid" };
      }
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return { ok: false, reason: "too-large" };
      }
      chunks.push(value);
    }
  } catch {
    try { await reader.cancel(); } catch {}
    return { ok: false, reason: "invalid" };
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}


export async function readBoundedResponseJson(response, maxBytes = 256 * 1024) {
  if (!Number.isInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError("maxBytes must be a positive integer.");
  }
  const declaredLength = response?.headers?.get?.("content-length");
  if (declaredLength !== null && declaredLength !== undefined) {
    if (!/^\d+$/.test(declaredLength)) return { ok: false, reason: "invalid" };
    if (Number(declaredLength) > maxBytes) return { ok: false, reason: "too-large" };
  }
  if (!response?.body || typeof response.body.getReader !== "function") {
    return { ok: false, reason: "invalid" };
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) {
        await reader.cancel();
        return { ok: false, reason: "invalid" };
      }
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return { ok: false, reason: "too-large" };
      }
      chunks.push(value);
    }
  } catch {
    try { await reader.cancel(); } catch {}
    return { ok: false, reason: "invalid" };
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, value };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
