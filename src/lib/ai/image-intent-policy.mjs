const IMAGE_NOUN = /\b(?:image|picture|photo|photograph|illustration|artwork|art|portrait|wallpaper|logo|poster|cover|banner|icon|thumbnail|scene|landscape|cityscape|character|diagram|infographic|drawing|sketch)\b/i;
const VISUAL_ACTION = /\b(?:generate|create|draw|sketch|paint|illustrate|render|design|make|show|visuali[sz]e)\b/i;
const NON_VISUAL_OBJECT = /^(?:a |an |the )?(?:conclusion|inference|comparison|plan|lesson|decision|argument|salary|boundary|attention|assumption|recommendation)\b/i;

/**
 * Conservative natural-language intent detection for the assistant composer.
 * Explicit visual nouns are accepted with common creation phrasing; direct
 * draw/sketch/paint requests also work without the word "image".
 */
export function isImageGenerationRequest(value) {
  const text = String(value || "").normalize("NFKC").trim();
  if (!text || text.length > 8000) return false;

  if (IMAGE_NOUN.test(text) && VISUAL_ACTION.test(text)) return true;
  if (/\b(?:i want|i need|make me|show me|give me)\b[\s\S]{0,100}\b(?:a |an |the )?(?:logo|picture|image|drawing|poster|wallpaper|portrait|illustration|icon|banner)\b/i.test(text)) return true;
  if (/\b(?:draw|sketch|paint|illustrate)\s+(?:me\s+)?(?:a |an |the )?([a-z][a-z-]{1,30})(?:\s+(?:of|with|in|wearing|under|on|at|beside|near)\b|[.!?]*$)/i.test(text)
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
