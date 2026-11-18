export const IMAGE_EDIT_STYLES = Object.freeze([
  { id: "cartoon", label: "Cartoon illustration" },
  { id: "anime", label: "Anime illustration" },
  { id: "comic", label: "Comic-book art" },
  { id: "3d-animation", label: "3D animated film" },
  { id: "watercolor", label: "Watercolour painting" },
]);

const STYLE_DIRECTIONS = Object.freeze({
  cartoon: "Transform the photograph into a polished 2D cartoon illustration with clean expressive linework, appealing but natural proportions, smooth colour shading and carefully drawn details.",
  anime: "Transform the photograph into a refined anime illustration while keeping the same real person's recognisable facial structure, hairstyle and expression.",
  comic: "Transform the photograph into a detailed comic-book illustration with confident ink lines, controlled halftone texture and rich but faithful colours.",
  "3d-animation": "Transform the photograph into a polished 3D animated-film-style portrait, retaining the same person's facial structure, hairstyle, expression and clothing.",
  watercolor: "Transform the photograph into a carefully painted watercolour portrait, preserving the person's face, expression, hairstyle and clothing.",
});

export function buildImageEditPrompt(style = "cartoon") {
  const direction = STYLE_DIRECTIONS[style];
  if (!direction) return null;
  return [
    "IMAGE-TO-IMAGE EDIT. The supplied photograph is the source image and must be transformed directly; do not invent a new subject.",
    direction,
    "IDENTITY AND CONTENT PRESERVATION ARE THE HIGHEST PRIORITY: depict the exact same person or people from the input photograph. Preserve recognisable identity, facial geometry, eyes, nose, mouth, skin tone, age, hairstyle, expression, clothing, accessories, body proportions, pose and orientation. If multiple people are present, preserve every person and their relative positions. Keep the original camera framing, crop, perspective, scene layout and background unless a change is essential to the selected art medium.",
    "Apply the requested art treatment to the whole photograph, including the background. This is a full-frame image transformation, not a sticker, emoji, avatar, mascot, cut-out, isolated headshot, character sheet or replacement portrait. Do not add a white sticker outline, die-cut border, transparent sticker background, text, logo, extra people, props or decorative elements.",
    "Keep the result compositionally close to the source. Do not change the subject's gender presentation, ethnicity, apparent age or identity. No generic stock character. Output one finished image.",
  ].join(" ");
}

export function parseImageEditInput(dataUrl, maxBytes = 4 * 1024 * 1024) {
  if (typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return null;
  const estimatedBytes = Math.floor(match[2].length * 3 / 4) - (match[2].endsWith("==") ? 2 : match[2].endsWith("=") ? 1 : 0);
  if (estimatedBytes < 1 || estimatedBytes > maxBytes) return null;
  return { mimeType: match[1], base64: match[2], estimatedBytes };
}
