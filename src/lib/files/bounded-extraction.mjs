export function createBoundedTextCollector(maxCharacters) {
  if (!Number.isInteger(maxCharacters) || maxCharacters < 1) {
    throw new TypeError("maxCharacters must be a positive integer.");
  }

  let text = "";
  let totalCharacters = 0;
  let truncated = false;

  function append(value) {
    const chunk = String(value ?? "");
    if (!chunk) return false;
    const separatorLength = text ? 1 : 0;
    const available = Math.max(0, maxCharacters - text.length - separatorLength);
    const accepted = chunk.slice(0, available);
    if (accepted) text += (separatorLength ? "\n" : "") + accepted;
    totalCharacters += chunk.length + separatorLength;
    if (accepted.length < chunk.length || text.length >= maxCharacters) {
      truncated = accepted.length < chunk.length || totalCharacters > text.length;
    }
    return !truncated;
  }

  return {
    append,
    get text() { return text; },
    get length() { return text.length; },
    get totalCharacters() { return totalCharacters; },
    get truncated() { return truncated; },
  };
}
