const IMAGE_NOUN = /\b(?:image|picture|photo|photograph|illustration|artwork|art|portrait|wallpaper|logo|poster|cover|banner|icon|thumbnail|scene|landscape|cityscape|character|diagram|infographic|drawing|sketch)\b/i;
const VISUAL_ACTION = /\b(?:generate|create|draw|sketch|paint|illustrate|render|design|make|show|visuali[sz]e)\b/i;
const NON_VISUAL_OBJECT = /^(?:a |an |the )?(?:conclusion|inference|comparison|plan|lesson|decision|argument|salary|boundary|attention|assumption|recommendation|business plan|study plan|lesson plan|project schedule|schedule|roadmap|strategy)\b/i;
const COMMON_VISUAL_SUBJECT = /\b(?:cat|dog|puppy|kitten|tiger|lion|elephant|bird|butterfly|dragon|robot|alien|astronaut|person|woman|man|child|family|tree|flower|rose|garden|forest|mountain|beach|ocean|waterfall|river|house|home|building|car|bike|motorcycle|airplane|ship|spaceship|planet|galaxy|castle|cafe|restaurant|cake|food|burger|pizza|coffee cup|product|mascot|character|dinosaur|unicorn|logo|poster|card|invitation|flyer|sticker)\b/i;
const WEBSITE_BUILD_ACTION = /\b(?:build|create|make|develop|design|code|implement|scaffold|launch)\b/i;
const WEBSITE_OBJECT = /\b(?:website|web site|web app|web application|landing page|portfolio site|e-?commerce site|online store|dashboard|saas app|mobile app)\b/i;
const NON_BUILDING_CONTEXT = /\b(?:explain|what is|how does|compare|summari[sz]e|write about|ideas for|teach me about|roadmap for|plan for)\b/i;
const MULTILINGUAL_IMAGE_REQUEST = /(?:\b(?:tasveer|tasvir|chitra|chitram|billi|kutte|kutta|phool|ped|gaadi|gadi|bekku|nayi|hoovu|mane|katte|surya|chandra|image|photo|picture|logo|poster|drawing)\b[\s\S]{0,90}\b(?:banao|bana do|banado|dikhao|draw|create|generate|maadu|maadi|maadiko|beku)\b|\b(?:banao|bana do|banado|dikhao|maadu|maadi|maadiko)\b[\s\S]{0,90}\b(?:tasveer|tasvir|chitra|chitram|billi|kutte|kutta|phool|ped|gaadi|gadi|bekku|nayi|hoovu|mane|surya|chandra|image|photo|picture|logo|poster|drawing)\b|ಚಿತ್ರ(?:ವನ್ನು)?\s*(?:ರಚಿಸು|ಮಾಡು|ತೋರಿಸು)|ಚಿತ್ರ\s*ಮಾಡಿ|ಚಿತ್ರ\s*ಬಿಡಿಸಿ|तस्वीर\s*(?:बनाओ|बना दो|दिखाओ)|चित्र\s*(?:बनाओ|बनाइए))/iu;

/**
 * Conservative natural-language intent detection for the assistant composer.
 * Explicit visual nouns are accepted with common creation phrasing; direct
 * draw/sketch/paint requests also work without the word "image".
 */
/** Recognise requests to build a real software product, not discuss one. */
export function isWebsiteBuildRequest(value) {
  const text = String(value || "").normalize("NFKC").trim();
  if (!text || text.length > 8000) return false;
  if (NON_BUILDING_CONTEXT.test(text) && !/\b(?:build|create|develop|implement|code)\b/i.test(text)) return false;
  const directBuildRequest = WEBSITE_BUILD_ACTION.test(text) && WEBSITE_OBJECT.test(text);
  const statedNeed = /\b(?:i need|i want)\b/i.test(text) && WEBSITE_OBJECT.test(text);
  return directBuildRequest || statedNeed;
}

export function isImageGenerationRequest(value) {
  const text = String(value || "").normalize("NFKC").trim();
  if (!text || text.length > 8000) return false;
  if (/\b(?:upload|attach|send|share)\b/i.test(text)) return false;

  if (IMAGE_NOUN.test(text) && VISUAL_ACTION.test(text)) return true;
  if (MULTILINGUAL_IMAGE_REQUEST.test(text)) return true;
  if (/\b(?:generate|create|make|render|design|visualise|visualize)\s+(?:me\s+)?(?:a |an |the )?/i.test(text)
    && COMMON_VISUAL_SUBJECT.test(text)
    && !NON_VISUAL_OBJECT.test(text.replace(/^.*?\b(?:generate|create|make|render|design|visualise|visualize)\s+/i, ""))) return true;
  if (/\b(?:i want|i need|make me|show me|give me)\b[\s\S]{0,100}\b(?:a |an |the )?(?:logo|picture|image|drawing|poster|wallpaper|portrait|illustration|icon|banner)\b/i.test(text)) return true;
  if (/\b(?:draw|sketch|paint|illustrate)\s+(?:me\s+)?(?:a |an |the )?([a-z][a-z-]{1,30})\b/i.test(text)
    && !NON_VISUAL_OBJECT.test(text.replace(/^.*?\b(?:draw|sketch|paint|illustrate)\s+/i, ""))) return true;
  if (/\b(?:make|create|design)\s+(?:me\s+)?(?:a |an |the )?(?:logo|poster|cover|banner|wallpaper|icon|thumbnail|avatar)\b/i.test(text)) return true;
  if (/\b(?:turn this into|visualise|visualize)\b/i.test(text) && /\b(?:art|visual|scene|picture|image|illustration)\b/i.test(text)) return true;

  const visualMarkers = [
    /\b(?:photorealistic|ultra[- ]realistic)\b/i,
    /\b(?:cinematic|wide[- ]shot|close[- ]up|wide[- ]angle)\b/i,
    /\b(?:volumetric lighting|depth of field|anamorphic|ray tracing)\b/i,
    /\b(?:8k|4k|high[- ]detail|ultra[- ]detailed)\b/i,
    /\b(?:negative prompt|aspect ratio|text[- ]to[- ]image)\b/i,
    /\b(?:bioluminescent|neon lighting|dramatic lighting|realistic reflections)\b/i,
  ];
  const markerCount = visualMarkers.filter((pattern) => pattern.test(text)).length;
  const hasVisualSubject = /\b(?:city|metropolis|landscape|ocean|underwater|space station|planet|portrait|character|architecture|skyscraper|forest|mountain|vehicle|spaceship|animal|interior|exterior|scene|coral|submarine|building)\b/i.test(text);
  return text.length >= 100 && markerCount >= 2 && hasVisualSubject;
}

/** Detect edit instructions; callers must also verify that an image is attached. */
export function isImageEditRequest(value) {
  const text = String(value || "").normalize("NFKC").trim();
  if (!text || text.length > 2000) return false;
  const editAction = /\b(?:edit|modify|retouch|remove|erase|replace|change|recolou?r|recolor|recolour|add|insert|crop|resize|brighten|darken|sharpen|restore|clean up|make it|turn it into|transform|hatao|hataiye|badlo|badal do|karo|kar do|maadi|maadu|madi)\b/i.test(text)
    || /\bmake\s+(?:the\s+)?(?:background|dress|shirt|hair|sky|lighting|photo|picture)\b/i.test(text);
  const visualTarget = /\b(?:background|colour|color|dress|shirt|hair|sky|object|person|face|lighting|light|shadow|text|logo|image|photo|picture|style|brightness|brighter|darker|contrast|saturation|exposure|watercolou?r|painting|cartoon|anime|realistic|transparent|blue|red|green|black|white|pink|purple|golden|warm|cool)\b/i.test(text);
  return editAction && visualTarget;
}
