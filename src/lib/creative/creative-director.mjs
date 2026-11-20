export const IMAGE_QUALITY_PRESETS = Object.freeze(["standard", "masterpiece"]);
export const VIDEO_DIRECTOR_PRESETS = Object.freeze(["cinematic", "commercial", "documentary", "anime", "none"]);

const IMAGE_MASTERPIECE_DIRECTION = [
  "Creative direction: produce a premium, portfolio-worthy hero image.",
  "Establish one unmistakable focal subject and a deliberate visual hierarchy.",
  "Use intentional composition, believable perspective, rich but controlled color, nuanced lighting, dimensional depth, tactile material detail, and crisp subject separation.",
  "Make fine details coherent and purposeful; avoid visual clutter, accidental text, malformed anatomy, duplicate objects, plastic-looking textures, and oversharpening.",
  "Preserve the subject and specific details requested by the user. Do not add logos, words, or extra objects unless requested."
].join(" ");

const VIDEO_DIRECTIONS = Object.freeze({
  cinematic: "Cinematic direction: define a clear opening composition, one readable subject action, motivated camera movement, natural physical motion, coherent spatial continuity, controlled focus, and a visually satisfying final frame. Keep motion smooth and avoid morphing, flicker, jitter, object duplication, and sudden scene changes.",
  commercial: "Commercial direction: create a premium, instantly readable product or brand moment with deliberate framing, elegant camera movement, clean lighting, accurate product details, and a polished final hero frame. Do not invent brand marks or text.",
  documentary: "Documentary direction: favor naturalistic light, observational camera movement, credible motion, grounded environments, and an authentic unstaged feeling. Avoid exaggerated effects.",
  anime: "Animation direction: maintain consistent character design, clean silhouettes, expressive but controlled motion, coherent staging, and stable visual style across every frame.",
});

export function buildImagePrompt(prompt, quality = "standard") {
  if (quality === "standard") return prompt;
  if (quality !== "masterpiece") return null;
  return `${prompt}\n\n${IMAGE_MASTERPIECE_DIRECTION}`;
}

export function buildVideoPrompt(prompt, director = "cinematic") {
  if (director === "none") return prompt;
  const direction = VIDEO_DIRECTIONS[director];
  if (!direction) return null;
  return `${prompt}\n\n${direction}`;
}

const PROVIDERS = Object.freeze([
  { id: "cloudflare", label: "Cloudflare Workers AI", capabilities: ["image-generation", "video-generation"], env: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"] },
  { id: "higgsfield", label: "Higgsfield", capabilities: ["image-generation", "image-editing", "video-generation", "motion-transfer", "character-consistency"], env: ["HIGGSFIELD_API_KEY_ID", "HIGGSFIELD_API_KEY_SECRET"] },
  { id: "elevenlabs", label: "ElevenLabs", capabilities: ["text-to-speech", "voice-design", "dubbing", "sound-effects", "music-generation"], env: ["ELEVENLABS_API_KEY"] },
  { id: "luma", label: "Luma", capabilities: ["image-generation", "image-editing", "text-to-video", "image-to-video", "character-reference"], env: ["LUMA_API_KEY"] },
  { id: "runway", label: "Runway", capabilities: ["image-generation", "video-generation", "video-editing", "audio"], env: ["RUNWAY_API_KEY"] },
  { id: "llama", label: "Meta Llama", capabilities: ["text-generation", "reasoning", "vision"], env: ["LLAMA_API_KEY"] },
]);

export function getCreativeProviderStatus(env = {}) {
  return PROVIDERS.map(({ id, label, capabilities, env: required }) => ({
    id,
    label,
    capabilities,
    configured: required.every((key) => typeof env[key] === "string" && env[key].trim().length > 0),
  }));
}
