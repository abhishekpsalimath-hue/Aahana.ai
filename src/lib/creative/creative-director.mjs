export const IMAGE_QUALITY_PRESETS = Object.freeze(["standard", "masterpiece"]);
export const VIDEO_DIRECTOR_PRESETS = Object.freeze(["cinematic", "commercial", "documentary", "anime", "none"]);

const IMAGE_MASTERPIECE_DIRECTION = [
  "Creative direction: produce a carefully art-directed, production-quality image that follows the user's brief exactly. Do not optimize for a generic beautiful image at the expense of the requested result.",
  "Establish one unmistakable focal subject and a deliberate visual hierarchy.",
  "Use intentional composition, believable perspective, rich but controlled color, nuanced lighting, dimensional depth, tactile material detail, and crisp subject separation.",
  "Treat the user prompt as a specification, not loose inspiration.",
  "Preserve the exact requested subject identity, number of subjects and objects, defining attributes, left/right placement, pose, setting, materials, palette, and framing.",
  "Interpret the request in the language it was written in; preserve proper names and any exact visible wording, and never invent text.",
  "Before rendering, resolve the brief into a visual specification: primary subject, exact subject and object counts, defining attributes, action or pose, environment, foreground/midground/background, camera viewpoint, framing, orientation, spatial relationships, lighting, materials, palette, style and any exact visible text. Preserve every explicit constraint and their relationships.",
  "Composition fidelity is mandatory. Respect requested left/right/top/bottom placement, relative scale, distance, orientation, crop, camera angle, negative space and aspect ratio. If the user specifies a count, show exactly that count. If the user specifies one subject, do not add background people or duplicate objects. Keep every important requested feature inside the frame unless an intentional crop is requested.",
  "Subject fidelity is mandatory. Preserve named identities, species, product silhouettes, clothing, accessories, architecture, cultural or scientific attributes, and distinctive details. Never substitute a named subject with a generic lookalike, merge separate subjects, silently redesign a product, or add unrequested logos and branding.",
  "Match the requested medium instead of forcing photorealism. For photography, use believable optics, exposure, skin and surface detail. For illustration, animation, anime, watercolor, vector art or stylized 3D, preserve the requested visual language consistently. Do not mix incompatible styles unless requested.",
  "Use physically coherent perspective, scale, contact shadows, reflections, anatomy, object boundaries and light direction. Faces, hands, fingers, eyes, limbs, wheels, architectural lines, repeated patterns and mechanical parts must be structurally coherent. Avoid melted geometry, duplicated features, impossible intersections, floating objects and plastic-looking materials unless the style intentionally calls for them.",
  "Treat text as exact data. Render only wording explicitly requested, preserve spelling, punctuation, capitalization and language, and do not invent labels, signatures, watermarks or decorative lettering. For diagrams, maps and educational visuals, keep labels attached to the correct objects and preserve factual relationships; if exact text cannot be rendered reliably, do not fabricate substitute words.",
  "Use a clear visual hierarchy and one intentional focal point. Separate the subject from the background with motivated lighting, depth and contrast. Keep fine detail purposeful and legible; avoid clutter, random decorative objects, excessive glow, oversharpening, artificial skin smoothing and uncontrolled color casts.",
  "Interpret multilingual prompts in their original language. Preserve proper names, regional clothing and cultural details without stereotyping or replacing them with generic imagery. Resolve ambiguity conservatively and prioritize explicit instructions over assumptions.",
  "Do not add extra subjects, props, captions, logos, frames, borders, visual effects or text unless they serve an explicit request. If the brief is intentionally minimal, keep it minimal. If the requested scene is complex, maintain clear separation and readable relationships rather than omitting details."
].join(" ");

const VIDEO_DIRECTIONS = Object.freeze({
  cinematic: "Cinematic direction: define a clear opening composition, one readable subject action, motivated camera movement, natural physical motion, coherent spatial continuity, controlled focus, and a visually satisfying final frame. Keep motion smooth and avoid morphing, flicker, jitter, object duplication, and sudden scene changes.",
  commercial: "Commercial direction: create a premium, instantly readable product or brand moment with deliberate framing, elegant camera movement, clean lighting, accurate product details, and a polished final hero frame. Do not invent brand marks or text.",
  documentary: "Documentary direction: favor naturalistic light, observational camera movement, credible motion, grounded environments, and an authentic unstaged feeling. Avoid exaggerated effects.",
  anime: "Animation direction: maintain consistent character design, clean silhouettes, expressive but controlled motion, coherent staging, and stable visual style across every frame.",
});

const ARDHANARISHVARA_DIRECTION = [
  "SUBJECT IDENTITY — Ardhanarishvara: depict one unified divine being, the combined form of Shiva and Parvati, not two people standing together, not two faces, and not a generic feminine portrait.",
  "COMPOSITION — a single human-like body shown front-facing, centered and symmetrical, with one continuous head, one neck, one torso and one pair of shoulders. A precise, unmistakable vertical division runs from the crown through the center of the forehead, nose, lips, chin, throat, chest and waist. The two halves must join naturally along the exact centerline; do not blend their defining traits into one averaged appearance.",
  "VIEWER-LEFT HALF — Parvati: warm natural golden-brown skin, soft feminine facial structure on this half only, graceful eye and cheek, long dark braided hair decorated with restrained fresh jasmine and a few marigold and lotus flowers. Rich crimson-saffron silk drape over this half of the torso, with believable woven fabric, fine embroidery and elegant traditional gold jewelry. Keep ornamentation physically plausible and not excessive.",
  "VIEWER-RIGHT HALF — Shiva: cool ash-grey to muted blue-grey skin on this half only, subtly masculine facial structure, calm half-closed eye, matted jata gathered naturally with a small crescent moon at the crown, rudraksha beads and a restrained ascetic detail. A trident may appear beside the figure, not intersecting the body. Keep this half dignified and serene.",
  "FACE AND ANATOMY — exactly one face with two complementary halves, one nose bridge, one mouth, one chin and two eyes positioned naturally. The center seam must be visible through the change in skin tone and facial characteristics, while the overall face remains anatomically coherent. No duplicate features, extra eyes, split heads, doubled noses, mismatched jawlines or melted facial geometry.",
  "NATURALISM — prioritize a believable devotional portrait over fantasy ornament overload. Realistic skin pores and subtle tonal variation, individual hair strands, naturally placed flowers, realistic textile folds, physically plausible jewelry, soft controlled highlights and restrained sacred glow. Avoid plastic skin, exaggerated makeup, neon fire, excessive gold, oversaturated colors and decorative clutter.",
  "BACKGROUND — a refined, softly illuminated cosmic mandala with subtle concentric geometry and a few lotus motifs. Keep it behind the figure, lower in contrast and softly out of focus so it never competes with the face.",
  "LIGHT — soft directional portrait lighting with gentle warm illumination on Parvati's half and cooler, subdued illumination on Shiva's half. Preserve natural skin texture and detail in both shadow and highlight areas.",
  "CAMERA AND FRAMING — follow the user's explicitly requested orientation, aspect ratio and framing; never force a portrait crop when landscape or widescreen was requested. If the user gives no framing, favor a balanced vertical devotional portrait. Keep the full central figure comfortably inside the frame, with a straight-on eye-level view, sharp focus on the face and upper body, and a softly blurred background.",
  "STRICT EXCLUSIONS — do not render a single all-feminine or all-masculine face; do not merge the two skin tones into one; do not omit the center division; do not create two separate people; no text, watermark, signature, extra limbs, deformed hands or ornamental objects covering the face."
].join(" ");

const SACRED_SUBJECT_DIRECTIONS = [
  {
    pattern: /(?:ಅರ್ಧನಾರೀಶ್ವರ|ಅರ್ಧನಾರೀಶ್ವರಮೂರ್ತಿ|அர்த்தநாரீஸ்வரர்|அர்த்தநாரீஸ்வரர்|అర్ధనారీశ్వరుడు)/u,
    direction: ARDHANARISHVARA_DIRECTION
  },
  {
    pattern: /(?:ಶಿವ|ಮಹಾದೇವ|சிவன்|மகாதேவன்|శివుడు|మహాదేవుడు)/u,
    direction: "Depict Lord Shiva (Mahadev) unmistakably as the Hindu deity, not a generic saint, monk, guru, or ordinary human. Include recognizable traditional iconography: blue-toned throat (Neelkanth), matted jatā hair with the crescent moon and a stream of the Ganga, tripundra ash stripes and third eye, rudraksha beads, and a trident (trishula); a serene divine presence. If seated, use a yogic Himalayan setting or Mount Kailash. Keep the face divine and dignified, with coherent anatomy and all requested attributes clearly visible."
  },
  {
    pattern: /(?:ಹನುಮಂತ|ಆಂಜನೇಯ|அனுமன்|ஆஞ்சநேயர்|హనుమంతుడు|ఆంజనేయుడు)/u,
    direction: "Depict Lord Hanuman (Anjaneya) unmistakably as the Hindu monkey-faced deity, not a human saint, monk, or generic warrior. Preserve the clearly recognizable vanara face and muzzle, expressive compassionate divine eyes, traditional crown or ornaments where appropriate, gada (mace), and devotional strength. If the scene calls for it, include a saffron dhoti and a reverent devotional pose. Do not replace the monkey-faced divine form with an ordinary human face."
  },
  {
    pattern: /(?:ಗಣೇಶ|ಗಣಪತಿ|விநாயகர்|பிள்ளையார்|గణేశుడు|వినాయకుడు)/u,
    direction: "Depict Lord Ganesha unmistakably as the elephant-headed Hindu deity, with a clear elephant face and trunk, traditional crown and ornaments, and his characteristic divine form. Never substitute an ordinary human face."
  },
  {
    pattern: /(?:ಕೃಷ್ಣ|ಶ್ರೀಕೃಷ್ಣ|கிருஷ்ணர்|கண்ணன்|కృష్ణుడు)/u,
    direction: "Depict Lord Krishna unmistakably as the Hindu deity, with a serene youthful divine appearance, blue-toned skin, peacock feather, yellow garments and flute when suitable to the requested scene. Do not substitute a generic human saint."
  },
  {
    pattern: /(?:ರಾಮ|ಶ್ರೀರಾಮ|ராமர்|ஸ்ரீராமர்|రాముడు|శ్రీరాముడు)/u,
    direction: "Depict Lord Rama unmistakably as the Hindu deity, with traditional divine iconography such as a bow, dignified royal-yet-humble presence, and appropriate traditional attire. Do not depict a generic monk or saint."
  },
  {
    pattern: /(?:शिव|महादेव|শিব|মহাদেব|શિવ|મહાદેવ)/u,
    direction: "Depict Lord Shiva (Mahadev) unmistakably as the Hindu deity, not a generic saint, monk, guru, or ordinary human. Include recognizable traditional iconography: blue-toned throat (Neelkanth), matted jata hair with the crescent moon and a stream of the Ganga, tripundra ash stripes and third eye, rudraksha beads, and a trident (trishula); a serene divine presence. If seated, use a yogic Himalayan setting or Mount Kailash. Keep the face divine and dignified, with coherent anatomy and all requested attributes clearly visible."
  },
  {
    pattern: /(?:हनुमान|হনুমান|હનુમાન)/u,
    direction: "Depict Lord Hanuman (Anjaneya) unmistakably as the Hindu monkey-faced deity, not a human saint, monk, or generic warrior. Preserve the clearly recognizable vanara face and muzzle, expressive compassionate divine eyes, traditional crown or ornaments where appropriate, gada (mace), and devotional strength. If the scene calls for it, include a saffron dhoti and a reverent devotional pose. Do not replace the monkey-faced divine form with an ordinary human face."
  },
  {
    pattern: /(?:गणेश|गणपति|विनायक|গণেশ|গণপতি|বিনায়ক|ગણેશ|ગણપતિ|વિનાયક)/u,
    direction: "Depict Lord Ganesha unmistakably as the elephant-headed Hindu deity, with a clear elephant face and trunk, traditional crown and ornaments, and his characteristic divine form. Never substitute an ordinary human face."
  },
  {
    pattern: /(?:कृष्ण|श्रीकृष्ण|কৃষ্ণ|শ্রীকৃষ্ণ|કૃષ્ણ|શ્રીકૃષ્ણ)/u,
    direction: "Depict Lord Krishna unmistakably as the Hindu deity, with a serene youthful divine appearance, blue-toned skin, peacock feather, yellow garments and flute when suitable to the requested scene. Do not substitute a generic human saint."
  },
  {
    pattern: /(?:राम|श्रीराम|রাম|শ্রীরাম|રામ|શ્રીરામ)/u,
    direction: "Depict Lord Rama unmistakably as the Hindu deity, with traditional divine iconography such as a bow, dignified royal-yet-humble presence, and appropriate traditional attire. Do not depict a generic monk or saint."
  },
  {
    pattern: /(?:अर्धनारीश्वर|অর্ধনারীশ্বর|અર્ધનારીશ્વર)/u,
    direction: ARDHANARISHVARA_DIRECTION
  },
  {
    pattern: /\bardhanarishvara\b|\bardhanarishwar\b|\bshiva\s*[-/]\s*parvati\s*combined\b/i,
    direction: ARDHANARISHVARA_DIRECTION
  },
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



const IMAGE_SERIES_FIELDS = Object.freeze({
  subject: "LOCKED SUBJECT IDENTITY",
  wardrobe: "LOCKED WARDROBE AND DISTINCTIVE FEATURES",
  palette: "LOCKED COLOR PALETTE",
  style: "LOCKED VISUAL STYLE AND MEDIUM",
  scene: "CURRENT SCENE",
  continuityNotes: "ADDITIONAL CONTINUITY CONSTRAINTS",
});
const MAX_IMAGE_SERIES_FIELD_LENGTH = 180;

export function buildImageSeriesPrompt(prompt, series) {
  if (series === undefined || series === null) return prompt;
  if (!series || typeof series !== "object" || Array.isArray(series)) return null;
  const allowedKeys = new Set([...Object.keys(IMAGE_SERIES_FIELDS), "sceneNumber"]);
  if (Object.keys(series).some((key) => !allowedKeys.has(key))) return null;

  const sceneNumber = series.sceneNumber;
  if (sceneNumber !== undefined && (!Number.isInteger(sceneNumber) || sceneNumber < 1 || sceneNumber > 12)) return null;

  const lines = [];
  for (const [key, value] of Object.entries(series)) {
    if (key === "sceneNumber") continue;
    if (typeof value !== "string" || value.length > MAX_IMAGE_SERIES_FIELD_LENGTH) return null;
    const normalized = value.trim();
    if (normalized) lines.push(`${IMAGE_SERIES_FIELDS[key]}: ${normalized}`);
  }
  if (lines.length === 0 && sceneNumber === undefined) return prompt;
  if (sceneNumber !== undefined) lines.unshift(`SCENE NUMBER: ${sceneNumber} of 12`);
  return [
    "IMAGE SERIES CONTINUITY: This image belongs to a connected visual series. Treat every LOCKED field as invariant across the series.",
    ...lines,
    "Preserve the same recognizable subject identity, facial structure, age cues, proportions, wardrobe details, accessories, palette, and rendering style in every scene. Change only what the CURRENT SCENE and the user's main prompt explicitly require. Do not reinterpret, recast, redesign, age, duplicate, or silently replace the subject. Keep lighting and perspective physically coherent with the described scene.",
    "CURRENT IMAGE REQUEST:",
    prompt,
  ].join("\n\n");
}

const VIDEO_CONTINUITY_FIELDS = Object.freeze({
  subject: "Subject identity and defining visual traits",
  setting: "Scene and environment",
  wardrobe: "Wardrobe and appearance",
  props: "Important props and their positions",
  action: "Primary action and its direction",
  camera: "Camera position and movement",
  openingFrame: "Opening frame",
  closingFrame: "Closing frame",
  referenceNotes: "Reference-image preservation notes",
});
const MAX_CONTINUITY_FIELD_LENGTH = 180;

const VIDEO_SHOT_TRANSITIONS = Object.freeze(["cut", "dissolve", "match-cut", "continuous"]);

function buildVideoShotSequence(shots) {
  if (!Array.isArray(shots) || shots.length < 1 || shots.length > 4) return null;
  let totalDuration = 0;
  const lines = [];
  for (const [index, shot] of shots.entries()) {
    if (!shot || typeof shot !== "object" || Array.isArray(shot)) return null;
    if (Object.keys(shot).some((key) => !["duration", "action", "camera", "framing", "screenDirection", "transition"].includes(key))) return null;
    if (!Number.isInteger(shot.duration) || shot.duration < 1 || shot.duration > 15) return null;
    if (typeof shot.action !== "string" || !shot.action.trim() || shot.action.length > 180) return null;
    if (shot.camera !== undefined && (typeof shot.camera !== "string" || shot.camera.length > 120)) return null;
    if (shot.framing !== undefined && (typeof shot.framing !== "string" || shot.framing.length > 80)) return null;
    if (shot.screenDirection !== undefined && (typeof shot.screenDirection !== "string" || shot.screenDirection.length > 80)) return null;
    if (shot.transition !== undefined && !VIDEO_SHOT_TRANSITIONS.includes(shot.transition)) return null;
    totalDuration += shot.duration;
    if (totalDuration > 15) return null;
    lines.push(`Shot ${index + 1} (${shot.duration}s): ${shot.action.trim()}${shot.camera?.trim() ? ` | Camera: ${shot.camera.trim()}` : ""}${shot.framing?.trim() ? ` | Framing: ${shot.framing.trim()}` : ""}${shot.screenDirection?.trim() ? ` | Screen direction: ${shot.screenDirection.trim()}` : ""}${shot.transition ? ` | Transition: ${shot.transition}` : ""}`);
  }
  return ["SHOT-BY-SHOT TIMELINE:", ...lines, "Respect the shot order and timing. Preserve the established screen direction, axis of action, subject eyeline, geography, and camera side across adjacent shots unless a motivated transition explicitly changes them. Match subject position and movement vectors at cuts; transitions must connect the preceding shot to the next rather than resetting the scene."].join("\n");
}

export function buildVideoContinuityPrompt(continuity) {
  if (!continuity || typeof continuity !== "object" || Array.isArray(continuity)) return null;
  const keys = Object.keys(continuity);
  if (keys.some((key) => !Object.hasOwn(VIDEO_CONTINUITY_FIELDS, key) && key !== "shots")) return null;

  const lines = [];
  for (const [key, value] of Object.entries(continuity)) {
    if (key === "shots") continue;
    if (typeof value !== "string" || value.length > MAX_CONTINUITY_FIELD_LENGTH) return null;
    const normalized = value.trim();
    if (normalized) lines.push(`${VIDEO_CONTINUITY_FIELDS[key]}: ${normalized}`);
  }
  const shotSequence = continuity.shots === undefined ? "" : buildVideoShotSequence(continuity.shots);
  if (continuity.shots !== undefined && shotSequence === null) return null;
  if (lines.length === 0 && !shotSequence) return "";
  return [
    "Continuity plan: treat the following details as a single coherent scene across the entire clip.",
    ...lines,
    shotSequence,
    "Keep subject identity, anatomy, scale, wardrobe, props, lighting direction, and spatial relationships stable from frame to frame. Make the stated action progress naturally; do not reset, teleport, duplicate, or redesign the subject. The closing frame should follow plausibly from the opening frame. Treat reference notes as preservation constraints, not permission to invent new details.",
  ].filter(Boolean).join("\n");
}


export function buildVideoPrompt(prompt, director = "cinematic") {
  if (director === "none") return prompt;
  const direction = VIDEO_DIRECTIONS[director];
  if (!direction) return null;
  return `${prompt}\n\n${direction}`;
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
