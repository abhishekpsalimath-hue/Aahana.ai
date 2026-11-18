export const IMAGE_EDIT_STYLES = Object.freeze([
  { id: "cartoon", label: "Cartoon illustration" },
  { id: "anime", label: "Anime illustration" },
  { id: "comic", label: "Comic-book art" },
  { id: "3d-animation", label: "3D animated film" },
  { id: "watercolor", label: "Watercolour painting" },
]);

const STYLE_DIRECTIONS = Object.freeze({
  cartoon: "Render the complete source photograph as a cohesive, hand-drawn 2D cartoon scene. Use consistent illustrated linework, simplified but recognisable shapes, natural proportions and clean cel shading. Cartoonise the people, objects and background together; do not isolate the people.",
  anime: "Render the complete source photograph as one cohesive anime-style scene. Use refined anime linework and colour treatment while keeping the same people, clothing, objects, spatial relationships and background. Do not turn the subject into a standalone anime avatar.",
  comic: "Render the complete source photograph as one cohesive comic-book panel, with expressive ink work, controlled halftone texture and faithful colours. Keep the original scene, people, objects and framing together.",
  "3d-animation": "Render the complete source photograph as a cohesive stylised 3D animated scene. Preserve the same people, clothing, objects, environment and camera framing; do not replace the people with generic animated characters.",
  watercolor: "Render the complete source photograph as one cohesive watercolour illustration, with natural pigment texture and soft colour transitions. Paint the people, objects and background as the same complete scene; do not crop to a portrait.",
});

function cleanEditInstruction(value) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 400)
    : "";
}

export function buildImageEditPrompt(style = "cartoon", instructions = {}) {
  const direction = STYLE_DIRECTIONS[style];
  if (!direction) return null;
  return [
    "SOURCE-LOCKED IMAGE EDIT: input_image_0 is the photograph to edit. Directly restyle this exact image. It is the source canvas, not merely inspiration or a character reference.",
    "PRIMARY TASK: change the visual rendering style while retaining the photograph's complete content and composition.",
    direction,
    "PRESERVE THE SOURCE: retain every original person and their recognisable facial features, age, skin tone, hairstyle, expression, clothing, accessories, body proportions, pose and position. Retain the original number of people, objects, background elements, lighting direction, camera angle, perspective, crop and aspect ratio. Keep people in their original locations in the frame.",
    "FULL-FRAME REQUIREMENT: apply the same selected art treatment across the entire image, edge to edge, including the background and foreground. The result must remain the same overall photograph, now illustrated.",
    "DO NOT: create a sticker, die-cut image, emoji, avatar, mascot, character sheet, isolated headshot or replacement portrait. Do not remove or add people, change the scene, invent props, add text or logos, add borders, or introduce a white outline or transparent background.",
    cleanEditInstruction(instructions.change) ? `USER-REQUESTED CHANGE: ${cleanEditInstruction(instructions.change)}.` : "Do not change the content or setting; only apply the selected visual style.",
    cleanEditInstruction(instructions.preserve) ? `USER-REQUESTED PRESERVATION: ${cleanEditInstruction(instructions.preserve)}.` : "Keep all original scene details, people, objects and framing.",
    "If a stylistic choice conflicts with preserving the source photograph, preserve the source content and composition. Return one complete full-frame edited image.",
  ].join(" ");
}

export function parseImageEditInput(dataUrl, maxBytes = 4 * 1024 * 1024) {
  if (typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match || match[2].length % 4 !== 0) return null;
  if (!Number.isFinite(maxBytes) || maxBytes < 1) return null;
  const estimatedBytes = Math.floor(match[2].length * 3 / 4) - (match[2].endsWith("==") ? 2 : match[2].endsWith("=") ? 1 : 0);
  if (estimatedBytes < 1 || estimatedBytes > maxBytes) return null;
  return { mimeType: match[1], base64: match[2], estimatedBytes };
}

export function parseImageEditOutput(value, maxBytes = 12 * 1024 * 1024) {
  if (typeof value !== "string" || !Number.isFinite(maxBytes) || maxBytes < 24) return null;
  if (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  const estimatedBytes = Math.floor(value.length * 3 / 4) - (value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0);
  if (estimatedBytes < 24 || estimatedBytes > maxBytes) return null;

  const header = Buffer.from(value.slice(0, 32), "base64");
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!pngSignature.every((byte, index) => header[index] === byte)) return null;
  if (header.readUInt32BE(8) !== 13 || header.toString("ascii", 12, 16) !== "IHDR") return null;
  if (header.readUInt32BE(16) < 1 || header.readUInt32BE(20) < 1) return null;

  return { base64: value, estimatedBytes };
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
  const transformation = /\b(?:convert|transform|turn|make|create|generate|change|cartooni[sz]e|stylize|style|redraw|illustrate|paint)\b/i.test(text);
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
