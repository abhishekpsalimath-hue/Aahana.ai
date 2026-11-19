// Incrementally parse OpenAI-compatible Server-Sent Events across arbitrary byte chunks.
export function createSseDeltaParser(onDelta) {
  if (typeof onDelta !== "function") throw new TypeError("onDelta must be a function.");
  let buffer = "";
  const parseLine = (line) => {
    const normalized = line.endsWith("\r") ? line.slice(0, -1) : line;
    if (!normalized.startsWith("data:")) return;
    const data = normalized.slice(5).trim();
    if (!data || data === "[DONE]") return;
    try {
      const payload = JSON.parse(data);
      const delta = payload.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta) onDelta(delta);
    } catch {
      // Ignore provider keepalive frames and non-JSON metadata.
    }
  };
  return {
    push(text) {
      buffer += String(text || "");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) parseLine(line);
    },
    flush() {
      if (buffer) parseLine(buffer);
      buffer = "";
    },
  };
}
