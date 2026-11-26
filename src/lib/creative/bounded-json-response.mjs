export async function readBoundedJson(streamingResponse, { maxBytes, label = "Response" } = {}) {
  if (!streamingResponse || !Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError("A response and positive byte limit are required.");
  }
  const declared = streamingResponse.headers?.get?.("content-length");
  if (declared != null) {
    if (!/^\d+$/.test(declared.trim())) throw new Error(label + " has an invalid content length.");
    if (Number(declared) > maxBytes) {
      try { await streamingResponse.body?.cancel(); } catch {}
      throw new Error(label + " exceeded the safe size limit.");
    }
  }
  if (!streamingResponse.body) throw new Error(label + " has no readable body.");
  const reader = streamingResponse.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new Error(label + " returned an invalid stream chunk.");
      total += value.byteLength;
      if (total > maxBytes) {
        try { await reader.cancel(); } catch {}
        throw new Error(label + " exceeded the safe size limit.");
      }
      chunks.push(value);
    }
  } catch (error) {
    try { await reader.cancel(); } catch {}
    throw error;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new Error(label + " is not valid UTF-8."); }
  try { return JSON.parse(text); }
  catch { throw new Error(label + " is not valid JSON."); }
}
