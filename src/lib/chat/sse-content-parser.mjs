export function createSseContentParser(onDelta) {
  if (typeof onDelta !== "function") {
    throw new TypeError("A stream delta handler is required.");
  }

  let buffer = "";
  let closed = false;

  const handleLine = (line) => {
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return;

    try {
      const payload = JSON.parse(data);
      const delta = payload?.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta) onDelta(delta);
    } catch {
      // Ignore provider keepalives, comments, and non-JSON metadata frames.
    }
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
    },
  };
}
