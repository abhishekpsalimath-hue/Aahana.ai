export function createSseContentParser(onDelta, { maxEventChars = 256_000 } = {}) {
  if (typeof onDelta !== "function") {
    throw new TypeError("A stream delta handler is required.");
  }

  let buffer = "";
  let dataLines = [];
  let closed = false;
  let firstChunk = true;
  let eventChars = 0;
  if (!Number.isSafeInteger(maxEventChars) || maxEventChars < 1) {
    throw new RangeError("The SSE event limit must be a positive safe integer.");
  }

  const dispatchEvent = () => {
    if (!dataLines.length) return;
    const data = dataLines.join("\n");
    dataLines = [];
    if (!data || data === "[DONE]") return;
    try {
      const payload = JSON.parse(data);
      const delta = payload?.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta) onDelta(delta);
    } catch {
      // Ignore provider keepalives, comments, and non-JSON metadata frames.
    }
  };

  const handleLine = (line) => {
    if (line === "") {
      dispatchEvent();
      return;
    }
    if (line.startsWith(":")) return;
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    if (field !== "data") return;
    let value = separator === -1 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    eventChars += value.length;
    if (eventChars > maxEventChars) {
      closed = true;
      buffer = "";
      dataLines = [];
      throw new RangeError("The SSE event exceeds the configured size limit.");
    }
    dataLines.push(value);
  };

  return {
    push(chunk) {
      if (closed) throw new Error("The stream parser is already closed.");
      if (typeof chunk !== "string") throw new TypeError("Stream chunks must be strings.");
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) handleLine(line.replace(/\r$/, ""));
    },
    finish() {
      if (closed) return;
      closed = true;
      if (buffer) handleLine(buffer.replace(/\r$/, ""));
      buffer = "";
      dispatchEvent();
    },
  };
}
