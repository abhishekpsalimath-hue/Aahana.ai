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

export function detectImageEditStyleFromPrompt(value) {
  const text = String(value || "").toLowerCase();
  if (/\b(?:anime|manga)\b/.test(text)) return "anime";
  if (/\b(?:comic|comic[- ]book)\b/.test(text)) return "comic";
  if (/\b(?:3d|three[- ]dimensional|animated[- ]film|pixar[- ]like)\b/.test(text)) return "3d-animation";
  if (/\b(?:watercolou?r|watercolou?r painting)\b/.test(text)) return "watercolor";
  return "cartoon";
}

export function isImageEditRequest(value, hasImage = false) {
  if (!hasImage) return false;
  const text = String(value || "").trim();
  if (!text) return false;
  const transformation = /\b(?:convert|transform|turn|make|change|cartooni[sz]e|stylize|style|redraw|illustrate|paint)\b/i.test(text);
  const targetStyle = /\b(?:cartoon|cartoonish|anime|manga|comic|illustration|illustrated|painting|watercolou?r|sketch|drawing|3d animated|animated film|art style)\b/i.test(text);
  return transformation && targetStyle;
}

export async function prepareImageForEditing(file, maxDimension = 512) {
  if (typeof window === "undefined" || typeof document === "undefined" || typeof Image === "undefined") {
    throw new Error("Photo preparation is available in the browser only.");
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("The selected photo could not be opened."));
    });
    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the photo for editing.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new Error("Could not prepare the photo for editing.");
    const imageDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not encode the photo."));
      reader.onerror = () => reject(new Error("Could not encode the photo."));
      reader.readAsDataURL(blob);
    });
    const outputScale = 1024 / Math.max(sourceWidth, sourceHeight);
    const outputWidth = Math.max(256, Math.min(1920, Math.round(sourceWidth * outputScale)));
    const outputHeight = Math.max(256, Math.min(1920, Math.round(sourceHeight * outputScale)));
    return { imageDataUrl, width: outputWidth, height: outputHeight };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
