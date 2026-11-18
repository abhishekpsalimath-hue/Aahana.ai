const VIDEO_NOUN = /\b(?:video|clip|film|animation|animated\s+video|short\s+film|reel)\b/i;
const VIDEO_ACTION = /\b(?:generate|create|make|render|produce|animate|turn\s+.+\s+into)\b/i;
const VIDEO_EDIT_ACTION = /\b(?:animate|make\s+it\s+move|bring\s+to\s+life|turn\s+this\s+into\s+a\s+video)\b/i;
const NON_VIDEO_CONTEXT = /\b(?:explain|what is|how does|how do i|ideas for|script for|storyboard for|plan for|write a)\b/i;

export function isVideoGenerationRequest(value) {
  const text = String(value || "").normalize("NFKC").trim();
  if (!text || text.length > 8000) return false;
  if (NON_VIDEO_CONTEXT.test(text) && !VIDEO_EDIT_ACTION.test(text)) return false;
  if (VIDEO_NOUN.test(text) && VIDEO_ACTION.test(text)) return true;
  if (VIDEO_EDIT_ACTION.test(text)) return true;
  if (/\b(?:banao|bana do|maadi|maadu)\b/i.test(text) &&
      /\b(?:video|clip|reel|animation|animated)\b/i.test(text)) return true;
  if (/(?:ವೀಡಿಯೊ|ವಿಡಿಯೋ)\s*(?:ಮಾಡಿ|ರಚಿಸಿ|ಮಾಡು)|वीडियो\s*(?:बनाओ|बना दो|बनाइए)/u.test(text)) return true;
  return false;
}

export function validateVideoGenerationInput({ prompt, duration = 5, resolution = "hd", generateAudio = true } = {}) {
  const cleanPrompt = typeof prompt === "string" ? prompt.normalize("NFKC").trim() : "";
  if (!cleanPrompt || cleanPrompt.length > 4000) throw new Error("Describe the video in 1–4,000 characters.");
  if (![5, 10, 15, 20].includes(duration)) throw new Error("Choose a video duration of 5, 10, 15 or 20 seconds.");
  if (!["hd", "fhd"].includes(resolution)) throw new Error("Choose HD or Full HD video.");
  if (typeof generateAudio !== "boolean") throw new Error("Audio setting must be true or false.");
  return Object.freeze({ prompt: cleanPrompt, duration, resolution, generateAudio });
}

export function isTrustedGeneratedVideoUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      (url.hostname === "aig.cloudflare.com" || url.hostname.endsWith(".aig.cloudflare.com"));
  } catch {
    return false;
  }
}
