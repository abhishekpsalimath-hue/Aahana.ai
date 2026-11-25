export const MAX_AGENT_UPSTREAM_JSON_BYTES = 1024 * 1024;

function upstreamError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export async function readBoundedUpstreamJson(response, maxBytes = MAX_AGENT_UPSTREAM_JSON_BYTES) {
  if (!response || typeof response !== "object" || !response.body ||
      !Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw upstreamError("Invalid upstream response or byte limit.", "INVALID_RESPONSE");
  }

  const declaredLength = response.headers?.get?.("content-length");
  if (declaredLength != null) {
    if (!/^\\d+$/.test(declaredLength.trim())) {
      throw upstreamError("Invalid upstream content length.", "INVALID_LENGTH");
    }
    if (Number(declaredLength) > maxBytes) {
      try { await response.body.cancel(); } catch {}
      throw upstreamError("Upstream response exceeded the byte limit.", "TOO_LARGE");
    }
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let raw = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        try { await reader.cancel(); } catch {}
        throw upstreamError("Upstream response exceeded the byte limit.", "TOO_LARGE");
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  } catch (error) {
    try { await reader.cancel(); } catch {}
    if (error?.code) throw error;
    throw upstreamError("Could not read upstream response.", "READ_FAILED");
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw upstreamError("Upstream response was not valid JSON.", "INVALID_JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw upstreamError("Upstream response must be a JSON object.", "INVALID_SHAPE");
  }
  return parsed;
}
