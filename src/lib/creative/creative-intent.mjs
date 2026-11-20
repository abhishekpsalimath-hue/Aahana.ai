export function isImageGenerationRequest(value) {
  const text = String(value || "").trim();
  if (!text) return false;

  if (/\b(?:generate|create|draw|paint|illustrate|render|make)\b[\s\S]{0,100}\b(?:shiva|mahadev|mahadeva|shankar|hanuman|anjaneya|maruti|ganesha|ganapati|vinayaka|krishna|rama|ram)\b/i.test(text)) return true;
  if (/\b(?:generate|create|draw|paint|illustrate|render|make)\b[\s\S]{0,180}\b(?:image|picture|illustration|artwork|portrait|wallpaper|logo|poster|cover|banner|icon|thumbnail|scene|landscape|cityscape|character|diagram)\b/i.test(text)) return true;
  if (/\b(?:show me|visuali[sz]e|turn this into|text[- ]to[- ]image)\b/i.test(text) && /\b(?:image|picture|art|illustration|render|visual)\b/i.test(text)) return true;
  if (/\b(?:please|can you|could you|i want|i need)\b[\s\S]{0,120}\b(?:generate|create|draw|paint|illustrate|render|make)\b/i.test(text) && /\b(?:image|picture|art|visual|logo|poster|wallpaper)\b/i.test(text)) return true;

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

export function isImageEditRequest(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  const visualTarget = /\b(?:background|foreground|lighting|light|shadow|color|colour|sky|moon|sun|clouds?|mountains?|stars?|water|ocean|hair|clothes|outfit|face|eyes|skin|object|person|subject|trident|gada|jewelry|ornaments?|composition|framing|camera|texture|style)\b/i;
  const editAction = /\b(?:change|replace|remove|add|adjust|edit|modify|transform|put|move|brighten|darken|blur|sharpen|crop|recolor|restyle)\b/i;
  return (editAction.test(text) && visualTarget.test(text)) ||
    /\bmake\b[\s\S]{0,35}\b(?:it|the background|the lighting|the colors?|the sky)\b[\s\S]{0,35}\b(?:cinematic|realistic|bright|brighter|dark|darker|detailed|vibrant|dramatic|colorful|minimal|soft|warm|cool)\b/i.test(text) ||
    /\b(?:more|less)\s+(?:cinematic|realistic|bright|dark|detailed|vibrant|dramatic|colorful|minimal|soft|warm|cool)\b/i.test(text);
}
