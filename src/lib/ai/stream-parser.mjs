// Incrementally parse OpenAI-compatible Server-Sent Events across arbitrary byte chunks.
export function createSseDeltaParser(onDelta) {
  if (typeof onDelta !== "function") throw new TypeError("onDelta must be a function.");
  let buffer = "";
  const parseLine = (line) => {
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return;
    try {
      const payload = JSON.parse(data);
      const delta = payload.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta) onDelta(delta);
    } catch {
      // Ignore provider keepalive frames and non-JSON metadata.
    }
  };
  const consumeLines = (flush = false) => {
    while (buffer.length) {
      const delimiterIndex = buffer.search(/[\r\n]/);
      if (delimiterIndex === -1) break;
      const delimiter = buffer[delimiterIndex];
      // A CR at the end of a chunk may be the first half of CRLF.
      if (delimiter === "\r" && delimiterIndex === buffer.length - 1 && !flush) break;
      const delimiterLength = delimiter === "\r" && buffer[delimiterIndex + 1] === "\n" ? 2 : 1;
      parseLine(buffer.slice(0, delimiterIndex));
      buffer = buffer.slice(delimiterIndex + delimiterLength);
    }
    if (flush && buffer) {
      parseLine(buffer);
      buffer = "";
    }
  };
  return {
    push(text) {
      buffer += String(text || "");
      consumeLines();
    },
    flush() {
      consumeLines(true);
    },
  };
}
