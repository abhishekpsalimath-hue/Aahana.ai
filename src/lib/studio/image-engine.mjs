const COLOR = /^#[0-9a-fA-F]{6}$/;
const MAX_LAYERS = 100;
const MAX_DIMENSION = 4096;

function safeText(value, max = 240) {
  return String(value ?? "").slice(0, max).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[char]);
}

function finite(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

export function validateImageScene(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const width = Math.round(finite(input.width, 1200, 64, MAX_DIMENSION));
  const height = Math.round(finite(input.height, 675, 64, MAX_DIMENSION));
  if (!Array.isArray(input.layers) || input.layers.length > MAX_LAYERS) return null;
  const background = COLOR.test(input.background) ? input.background : "#f4f0e8";
  const layers = [];
  for (const layer of input.layers) {
    if (!layer || typeof layer !== "object") return null;
    const type = ["rect", "circle", "line", "text"].includes(layer.type) ? layer.type : null;
    if (!type) return null;
    const fill = COLOR.test(layer.fill) ? layer.fill : "#29243a";
    const stroke = COLOR.test(layer.stroke) ? layer.stroke : "none";
    const common = { type, fill, stroke, strokeWidth: finite(layer.strokeWidth, 2, 0, 40), opacity: finite(layer.opacity, 1, 0, 1) };
    if (type === "rect") layers.push({ ...common, x: finite(layer.x, 0, 0, width), y: finite(layer.y, 0, 0, height), width: finite(layer.width, 100, 0, width), height: finite(layer.height, 100, 0, height), radius: finite(layer.radius, 0, 0, 200) });
    if (type === "circle") layers.push({ ...common, cx: finite(layer.cx, width / 2, 0, width), cy: finite(layer.cy, height / 2, 0, height), radius: finite(layer.radius, 40, 0, Math.max(width, height)) });
    if (type === "line") layers.push({ ...common, x1: finite(layer.x1, 0, 0, width), y1: finite(layer.y1, 0, 0, height), x2: finite(layer.x2, width, 0, width), y2: finite(layer.y2, height, 0, height) });
    if (type === "text") layers.push({ ...common, x: finite(layer.x, 40, 0, width), y: finite(layer.y, 80, 0, height), size: finite(layer.size, 32, 8, 240), weight: [400, 500, 600, 700, 800, 900].includes(Number(layer.weight)) ? Number(layer.weight) : 600, text: safeText(layer.text, 500), anchor: ["start", "middle", "end"].includes(layer.anchor) ? layer.anchor : "start" });
  }
  return { width, height, background, layers };
}

export function renderImageSceneSvg(input) {
  const scene = validateImageScene(input);
  if (!scene) throw new TypeError("Invalid Aahana image scene.");
  const elements = scene.layers.map((layer) => {
    const style = `fill="${layer.fill}" stroke="${layer.stroke}" stroke-width="${layer.strokeWidth}" opacity="${layer.opacity}"`;
    if (layer.type === "rect") return `<rect x="${layer.x}" y="${layer.y}" width="${layer.width}" height="${layer.height}" rx="${layer.radius}" ${style}/>`;
    if (layer.type === "circle") return `<circle cx="${layer.cx}" cy="${layer.cy}" r="${layer.radius}" ${style}/>`;
    if (layer.type === "line") return `<line x1="${layer.x1}" y1="${layer.y1}" x2="${layer.x2}" y2="${layer.y2}" ${style}/>`;
    return `<text x="${layer.x}" y="${layer.y}" font-family="system-ui,sans-serif" font-size="${layer.size}" font-weight="${layer.weight}" text-anchor="${layer.anchor}" ${style}>${layer.text}</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}" role="img"><rect width="100%" height="100%" fill="${scene.background}"/>${elements}</svg>`;
}

export function createImageScene({ title = "Aahana Studio", subtitle = "Ideas, made visible", width = 1200, height = 675 } = {}) {
  return {
    width, height, background: "#f4f0e8",
    layers: [
      { type: "circle", cx: width * 0.78, cy: height * 0.42, radius: Math.min(width, height) * 0.22, fill: "#b9a5d4" },
      { type: "circle", cx: width * 0.68, cy: height * 0.62, radius: Math.min(width, height) * 0.12, fill: "#e9a8c2", opacity: 0.9 },
      { type: "text", x: width * 0.08, y: height * 0.42, size: Math.min(72, width * 0.06), weight: 800, fill: "#342c35", text: title },
      { type: "text", x: width * 0.08, y: height * 0.52, size: Math.min(28, width * 0.024), weight: 500, fill: "#655b66", text: subtitle },
    ],
  };
}


export function buildPinterestInspiredPrompt({ title = "Original creative", notes = "" } = {}) {
  const cleanTitle = String(title).trim().slice(0, 160);
  const cleanNotes = String(notes).trim().replace(/https?:\/\/\S+/gi, "").slice(0, 1200);
  if (!cleanNotes) return "";
  return [
    "Create an original, polished visual design. Do not reproduce or imitate any existing artwork, logo, character, or exact composition.",
    `Creative subject: ${cleanTitle || "Original creative"}.`,
    `Art direction supplied by the user: ${cleanNotes}`,
    "Use the reference only as high-level inspiration for mood, colour relationships, visual hierarchy and general design sensibility. Make the layout, details and artwork distinct and original. No watermarks, no copied branding, no fake text; leave clean space for typography where appropriate."
  ].join("\n");
}
