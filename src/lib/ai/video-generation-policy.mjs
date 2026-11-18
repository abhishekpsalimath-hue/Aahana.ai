const VIDEO_NOUN = /\b(?:video|clip|film|animation|animated\s+video|short\s+film|reel)\b/i;
const VIDEO_ACTION = /\b(?:generate|create|make|render|produce|animate|turn\s+.+\s+into)\b/i;
const VIDEO_EDIT_ACTION = /\b(?:animate|make\s+it\s+move|bring\s+to\s+life|turn\s+this\s+into\s+a\s+video)\b/i;
const NON_VIDEO_CONTEXT = /\b(?:explain|what is|how does|how do i|ideas for|script for|storyboard for|plan for|write a)\b/i;
const SOFTWARE_CONTEXT = /\b(?:video\s+player|video\s+editor|video\s+website|video\s+app|website|web\s+app|mobile\s+app|application|component|code|coding|program|html|css|javascript|react|next\.js|api|embed|stream|streaming|upload|player)\b/i;

export function isVideoGenerationRequest(value) {
  const text = String(value || "").normalize("NFKC").trim();
  if (!text || text.length > 8000) return false;
  if (SOFTWARE_CONTEXT.test(text)) return false;
  if (NON_VIDEO_CONTEXT.test(text) && !VIDEO_EDIT_ACTION.test(text)) return false;
  if (VIDEO_NOUN.test(text) && VIDEO_ACTION.test(text)) return true;
  if (VIDEO_EDIT_ACTION.test(text)) return true;
  if (/\b(?:banao|bana do|maadi|maadu)\b/i.test(text) &&
      /\b(?:video|clip|reel|animation|animated)\b/i.test(text)) return true;
  if (/(?:ವೀಡಿಯೊ|ವಿಡಿಯೋ)\s*(?:ಮಾಡಿ|ರಚಿಸಿ|ಮಾಡು)|वीडियो\s*(?:बनाओ|बना दो|बनाइए)/u.test(text)) return true;
  return false;
}

export function validateVideoGenerationInput({ prompt, duration = 5, resolution = "hd", aspectRatio = "16:9", generateAudio = true } = {}) {
  const cleanPrompt = typeof prompt === "string" ? prompt.normalize("NFKC").trim() : "";
  if (!cleanPrompt || cleanPrompt.length > 4000) throw new Error("Describe the video in 1–4,000 characters.");
  if (!Number.isInteger(duration) || duration < 5 || duration > 20) throw new Error("Video duration must be between 5 and 20 seconds.");
  if (!["hd", "fhd"].includes(resolution)) throw new Error("Choose HD or Full HD video.");
  if (!["16:9", "9:16", "1:1"].includes(aspectRatio)) throw new Error("Choose landscape, portrait or square video.");
  if (typeof generateAudio !== "boolean") throw new Error("Audio setting must be true or false.");
  return Object.freeze({ prompt: cleanPrompt, duration, resolution, aspectRatio, generateAudio });
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
