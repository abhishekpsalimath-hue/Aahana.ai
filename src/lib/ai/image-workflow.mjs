export const IMAGE_WORKFLOW_LIMITS = Object.freeze({
  maxBytes: 2 * 1024 * 1024,
  maxPromptLength: 2048,
  outputMaxBytes: 15 * 1024 * 1024,
});

export function parseImageDataUrl(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^data:(image\\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return null;
  const [, mimeType, base64] = match;
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.length > IMAGE_WORKFLOW_LIMITS.maxBytes || bytes.toString("base64") !== base64) return null;
  return { mimeType, base64, bytes };
}

export function parseGuardVerdict(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "safe" || normalized.startsWith("safe\n")) return { safe: true };
  if (normalized.startsWith("unsafe")) return { safe: false };
  return null;
}

export function parseVisualSafetyVerdict(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (typeof parsed.safe !== "boolean") return null;
    return { safe: parsed.safe, reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 160) : "" };
  } catch {
    return null;
  }
}

export function isAllowedPrompt(value) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= IMAGE_WORKFLOW_LIMITS.maxPromptLength;
}

export function isSafeProviderImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "aig.cloudflare.com" || url.hostname.endsWith(".aig.cloudflare.com"));
  } catch {
    return false;
  }
}
