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

const SACRED_SUBJECT_DIRECTIONS = [
  {
    pattern: /\b(lord\s+)?shiva\b|\bmahadev\b|\bmahadeva\b|\bshankar\b/i,
    direction: "Depict Lord Shiva (Mahadev) unmistakably as the Hindu deity, not a generic saint, monk, guru, or ordinary human. Include recognizable traditional iconography: blue-toned throat (Neelkanth), matted jatā hair with the crescent moon and a stream of the Ganga, tripundra ash stripes and third eye, rudraksha beads, and a trident (trishula); a serene divine presence. If seated, use a yogic Himalayan setting or Mount Kailash. Keep the face divine and dignified, with coherent anatomy and all requested attributes clearly visible."
  },
  {
    pattern: /\b(hanuman|anjaneya|anjaneya swamy|maruti)\b/i,
    direction: "Depict Lord Hanuman (Anjaneya) unmistakably as the Hindu monkey-faced deity, not a human saint, monk, or generic warrior. Preserve the clearly recognizable vanara face and muzzle, expressive compassionate divine eyes, traditional crown or ornaments where appropriate, gada (mace), and devotional strength. If the scene calls for it, include a saffron dhoti and a reverent devotional pose. Do not replace the monkey-faced divine form with an ordinary human face."
  },
  {
    pattern: /\b(lord\s+)?ganesha\b|\bganapati\b|\bvinayaka\b/i,
    direction: "Depict Lord Ganesha unmistakably as the elephant-headed Hindu deity, with a clear elephant face and trunk, traditional crown and ornaments, and his characteristic divine form. Never substitute an ordinary human face."
  },
  {
    pattern: /\b(lord\s+)?krishna\b/i,
    direction: "Depict Lord Krishna unmistakably as the Hindu deity, with a serene youthful divine appearance, blue-toned skin, peacock feather, yellow garments and flute when suitable to the requested scene. Do not substitute a generic human saint."
  },
  {
    pattern: /\b(lord\s+)?rama\b|\bshri\s+ram\b/i,
    direction: "Depict Lord Rama unmistakably as the Hindu deity, with traditional divine iconography such as a bow, dignified royal-yet-humble presence, and appropriate traditional attire. Do not depict a generic monk or saint."
  }
];

export function buildImagePrompt(prompt, quality = "masterpiece") {
  if (quality !== "standard" && quality !== "masterpiece") return null;
  const subject = SACRED_SUBJECT_DIRECTIONS.find(({ pattern }) => pattern.test(prompt));
  const direction = quality === "masterpiece" ? IMAGE_MASTERPIECE_DIRECTION : "";
  return [prompt, subject?.direction, direction].filter(Boolean).join("\n\n");
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
  { id: "llama", label: "Llama-compatible model endpoint", capabilities: ["text-generation", "reasoning", "vision"], env: ["LLAMA_API_BASE_URL", "LLAMA_API_KEY"] },
  { id: "fal", label: "fal", capabilities: ["image-generation", "image-editing", "video-generation", "audio-generation", "3d-generation"], env: ["FAL_KEY"] },
  { id: "replicate", label: "Replicate", capabilities: ["image-generation", "image-editing", "video-generation", "audio-generation", "3d-generation"], env: ["REPLICATE_API_TOKEN"] },
]);

export function getCreativeProviderStatus(env = {}) {
  return PROVIDERS.map(({ id, label, capabilities, env: required }) => ({
    id,
    label,
    capabilities,
    configured: required.every((key) => typeof env[key] === "string" && env[key].trim().length > 0),
  }));
}
