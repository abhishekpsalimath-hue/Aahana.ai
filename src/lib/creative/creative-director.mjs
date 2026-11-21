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
    pattern: /\b(lord\s+)?shiva\b|\bmahadev\b|\bmahadeva\b|\bshankar\b|ಶಿವ|ಮಹಾದೇವ|ಶಂಕರ|ರುದ್ರ|शिव|महादेव|शंकर|रुद्र/i,
    direction: "Depict Lord Shiva (Mahadev) unmistakably as the Hindu deity, never as a generic saint, monk, guru, or ordinary human. Preserve the requested form and scene exactly: if the user names a manifestation such as Nataraja, Ardhanarishvara, Dakshinamurthy, or another specific form, portray that form faithfully and do not replace it with the standard seated-yogi depiction. For a general depiction, use recognizable traditional Shaiva iconography appropriate to the scene: blue-toned throat (Neelkanth), matted jatā hair, crescent moon, Ganga, tripundra ash stripes, third eye, rudraksha beads, and trident (trishula). Include only attributes compatible with the specified form; do not force every attribute into one image. Keep the divine identity unmistakable, dignified, and anatomically coherent."
  },
  {
    pattern: /\b(hanuman|anjaneya|anjaneya swamy|maruti)\b|ಹನುಮಂತ|ಆಂಜನೇಯ|ಹನುಮಾನ್|ಮಾರುತಿ|हनुमान|अंजनेय|मारुति/i,
    direction: "Depict Lord Hanuman (Anjaneya) unmistakably as the Hindu vanara deity, never as an ordinary human, human-faced saint, monk, or generic warrior. The face must clearly read as a monkey-faced vanara with a recognizable muzzle and expressive divine eyes. Preserve the exact form requested, including specific forms such as Panchamukhi Hanuman when named; do not substitute a single-faced generic depiction. Use traditional crown or ornaments, gada (mace), saffron dhoti, and devotional pose only where appropriate to the requested scene. Never humanize away the vanara face."
  },
  {
    pattern: /\b(lord\s+)?ganesha\b|\bganapati\b|\bvinayaka\b|ಗಣೇಶ|ಗಣಪತಿ|ವಿನಾಯಕ|गणेश|गणपति|विनायक/i,
    direction: "Depict Lord Ganesha unmistakably as the elephant-headed Hindu deity, with a clearly visible elephant face and trunk. Preserve any specific form or pose requested by the user; use traditional crown, ornaments, and attributes only where compatible with that form. Never substitute an ordinary human face."
  },
  {
    pattern: /\b(lord\s+)?krishna\b|ಕೃಷ್ಣ|ಶ್ರೀಕೃಷ್ಣ|कृष्ण|श्रीकृष्ण/i,
    direction: "Depict Lord Krishna unmistakably as the Hindu deity, with a serene youthful divine appearance. Preserve the requested form and scene; for a general depiction, use blue-toned skin, peacock feather, yellow garments, and flute where suitable. Do not substitute a generic human saint or override a specifically requested form."
  },
  {
    pattern: /\b(lord\s+)?rama\b|\bshri\s+ram\b|ರಾಮ|ಶ್ರೀರಾಮ|राम|श्रीराम/i,
    direction: "Depict Lord Rama unmistakably as the Hindu deity, preserving the requested form and scene. For a general depiction, use traditional iconography such as a bow and dignified royal-yet-humble presence with appropriate attire. Do not depict a generic monk or saint or override a specifically requested form."
  }
];

export function buildImagePrompt(prompt, quality = "masterpiece") {
  if (quality !== "standard" && quality !== "masterpiece") return null;
  const subject = SACRED_SUBJECT_DIRECTIONS.find(({ pattern }) => pattern.test(prompt));
  const direction = quality === "masterpiece" ? IMAGE_MASTERPIECE_DIRECTION : "";
  return [subject?.direction, "User request (preserve exactly): " + prompt, direction].filter(Boolean).join("\n\n");
}

export function buildImageEditPrompt(referencePrompt, editPrompt) {
  const original = typeof referencePrompt === "string" ? referencePrompt.trim().slice(0, 1200) : "";
  const refinement = typeof editPrompt === "string" ? editPrompt.trim() : "";
  if (!refinement) return null;
  const brief = [
    original ? `Original image brief: ${original}` : "",
    `Requested refinement: ${refinement}`,
    "Use the supplied reference image as the source of truth. Preserve the exact main subject, identity, face, anatomy, pose, clothing, sacred attributes, composition, and all existing details unless the user explicitly asks to change them. Make only the requested refinement. Do not replace, reinterpret, or redesign the subject.",
  ].filter(Boolean).join("\n\n");
  return buildImagePrompt(brief, "masterpiece");
}

export function buildVideoPrompt(prompt, director = "cinematic") {
  if (director === "none") return prompt;
  const direction = VIDEO_DIRECTIONS[director];
  if (!direction) return null;
  const subject = SACRED_SUBJECT_DIRECTIONS.find(({ pattern }) => pattern.test(prompt));
  if (!subject) return `${prompt}\n\n${direction}`;
  const continuity = "Sacred-subject continuity: preserve the same deity identity, requested manifestation, face, anatomy, costume, ornaments, and defining attributes in every frame. Keep the named form stable throughout all motion. Never morph into another deity, a generic human, or a different manifestation. Avoid facial drift, extra limbs, duplicated attributes, flicker, and shape changes.";
  return [
    subject.direction,
    "User request (preserve exactly): " + prompt,
    direction,
    continuity,
  ].join("\n\n");
}

const PROVIDERS = Object.freeze([
  { id: "cloudflare", label: "Cloudflare Workers AI", capabilities: ["image-generation", "image-editing", "video-generation"], env: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"] },
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
