const DEFAULT_MAX_CHARACTERS = 14000;
const TRUNCATION_NOTICE = "[This file was longer than Aahana's document-analysis limit. Only the beginning of the extracted text is included below.]";

export function limitDocumentText(value, maxCharacters = DEFAULT_MAX_CHARACTERS) {
  const source = typeof value === "string" ? value.replace(/\u0000/g, "").trim() : "";
  const limit = Number.isInteger(maxCharacters) && maxCharacters > 0 ? maxCharacters : DEFAULT_MAX_CHARACTERS;
  const truncated = source.length > limit;
  if (!truncated) {
    return { text: source, truncated: false, extractedCharacters: source.length };
  }

  const prefix = TRUNCATION_NOTICE + "\n\n";
  const available = Math.max(0, limit - prefix.length);
  return {
    text: (prefix.slice(0, limit) + source.slice(0, available)).slice(0, limit),
    truncated: true,
    extractedCharacters: source.length,
  };
}
