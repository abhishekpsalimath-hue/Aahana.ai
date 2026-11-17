const SCHEMA = "aahana-project/v1";
const MAX_ASSETS = 500;
const MAX_SCENES = 100;
const MAX_LAYERS = 100;
const MAX_TRACKS = 100;
const MAX_OBJECTS = 200;
const MAX_FILE_SIZE = 250 * 1024 * 1024;
const ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;
const GEOMETRIES = new Set(["sphere", "box", "torus", "torus-knot", "cone", "icosahedron", "cylinder", "plane"]);
const MOTION_PROPERTIES = new Set(["x", "y", "z", "rotationX", "rotationY", "rotationZ", "scale", "opacity"]);
const EASINGS = new Set(["linear", "ease-in", "ease-out", "ease-in-out"]);
const ASSET_KINDS = new Set(["image", "audio", "video", "model-3d", "font", "other"]);

const isRecord = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const boundedNumber = (value, fallback, min, max) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};
const safeString = (value, max = 160) => String(value ?? "").trim().slice(0, max);
const validId = (value) => typeof value === "string" && ID.test(value);

export function createStudioProject({ id = "project-1", title = "Untitled Aahana project", width = 1920, height = 1080, fps = 30, duration = 10000, now = new Date().toISOString() } = {}) {
  return {
    schema: SCHEMA,
    id: validId(id) ? id : "project-1",
    title: safeString(title, 120) || "Untitled Aahana project",
    createdAt: now,
    updatedAt: now,
    settings: {
      width: Math.round(boundedNumber(width, 1920, 64, 4096)),
      height: Math.round(boundedNumber(height, 1080, 64, 4096)),
      fps: Math.round(boundedNumber(fps, 30, 1, 60)),
      duration: Math.round(boundedNumber(duration, 10000, 100, 60000)),
      background: "#f4f0e8",
    },
    assets: [],
    scenes: [{
      id: "scene-1",
      title: "Scene 1",
      duration: Math.round(boundedNumber(duration, 10000, 100, 60000)),
      layers: [],
      motion: [],
      objects3d: [],
    }],
  };
}

export function validateStudioProject(input) {
  if (!isRecord(input) || input.schema !== SCHEMA || !validId(input.id) || !isRecord(input.settings)) return null;
  if (!Array.isArray(input.assets) || input.assets.length > MAX_ASSETS || !Array.isArray(input.scenes) || input.scenes.length < 1 || input.scenes.length > MAX_SCENES) return null;
  const settings = {
    width: Math.round(boundedNumber(input.settings.width, 1920, 64, 4096)),
    height: Math.round(boundedNumber(input.settings.height, 1080, 64, 4096)),
    fps: Math.round(boundedNumber(input.settings.fps, 30, 1, 60)),
    duration: Math.round(boundedNumber(input.settings.duration, 10000, 100, 60000)),
    background: COLOR.test(input.settings.background) ? input.settings.background : "#f4f0e8",
  };
  const assets = [];
  const assetIds = new Set();
  for (const asset of input.assets) {
    if (!isRecord(asset) || !validId(asset.id) || assetIds.has(asset.id) || !ASSET_KINDS.has(asset.kind)) return null;
    const size = Number(asset.size);
    if (!Number.isSafeInteger(size) || size < 0 || size > MAX_FILE_SIZE) return null;
    const storageKey = safeString(asset.storageKey, 240);
    if (!storageKey || storageKey.startsWith("/") || storageKey.includes("..") || storageKey.includes("\\\\")) return null;
    assets.push({
      id: asset.id,
      kind: asset.kind,
      name: safeString(asset.name, 180) || "Untitled asset",
      mimeType: safeString(asset.mimeType, 100),
      size,
      storageKey,
      createdAt: safeString(asset.createdAt, 40),
    });
    assetIds.add(asset.id);
  }
  const scenes = [];
  const sceneIds = new Set();
  for (const scene of input.scenes) {
    if (!isRecord(scene) || !validId(scene.id) || sceneIds.has(scene.id)) return null;
    if (!Array.isArray(scene.layers) || scene.layers.length > MAX_LAYERS || !Array.isArray(scene.motion) || scene.motion.length > MAX_TRACKS || !Array.isArray(scene.objects3d) || scene.objects3d.length > MAX_OBJECTS) return null;
    const layerIds = new Set();
    const layers = [];
    for (const layer of scene.layers) {
      if (!isRecord(layer) || !validId(layer.id) || layerIds.has(layer.id)) return null;
      if (!new Set(["image", "text", "shape", "video", "audio"]).has(layer.type)) return null;
      if (layer.assetId != null && !assetIds.has(layer.assetId)) return null;
      layerIds.add(layer.id);
      layers.push({
        id: layer.id,
        type: layer.type,
        name: safeString(layer.name, 120),
        assetId: layer.assetId || null,
        x: boundedNumber(layer.x, 0, -100000, 100000),
        y: boundedNumber(layer.y, 0, -100000, 100000),
        width: boundedNumber(layer.width, 100, 0, 100000),
        height: boundedNumber(layer.height, 100, 0, 100000),
        rotation: boundedNumber(layer.rotation, 0, -36000, 36000),
        opacity: boundedNumber(layer.opacity, 1, 0, 1),
        text: layer.type === "text" ? safeString(layer.text, 2000) : "",
        fill: COLOR.test(layer.fill) ? layer.fill : "#342c35",
      });
    }
    const motion = [];
    const trackIds = new Set();
    for (const track of scene.motion) {
      if (!isRecord(track) || !validId(track.id) || trackIds.has(track.id) || !layerIds.has(track.targetLayerId) || !MOTION_PROPERTIES.has(track.property) || !Array.isArray(track.keyframes) || track.keyframes.length < 2 || track.keyframes.length > 200) return null;
      let lastTime = -1;
      const keyframes = [];
      for (const frame of track.keyframes) {
        if (!isRecord(frame)) return null;
        const time = Math.round(boundedNumber(frame.time, -1, 0, settings.duration));
        const value = Number(frame.value);
        if (time <= lastTime || !Number.isFinite(value)) return null;
        keyframes.push({ time, value: boundedNumber(value, 0, -100000, 100000), easing: EASINGS.has(frame.easing) ? frame.easing : "linear" });
        lastTime = time;
      }
      trackIds.add(track.id);
      motion.push({ id: track.id, targetLayerId: track.targetLayerId, property: track.property, keyframes });
    }
    const objects3d = [];
    const objectIds = new Set();
    for (const object of scene.objects3d) {
      if (!isRecord(object) || !validId(object.id) || objectIds.has(object.id) || !GEOMETRIES.has(object.geometry)) return null;
      if (object.assetId != null && !assetIds.has(object.assetId)) return null;
      const vector = (value, fallback) => isRecord(value) ? { x: boundedNumber(value.x, fallback.x, -100000, 100000), y: boundedNumber(value.y, fallback.y, -100000, 100000), z: boundedNumber(value.z, fallback.z, -100000, 100000) } : fallback;
      objects3d.push({
        id: object.id,
        geometry: object.geometry,
        assetId: object.assetId || null,
        position: vector(object.position, { x: 0, y: 0, z: 0 }),
        rotation: vector(object.rotation, { x: 0, y: 0, z: 0 }),
        scale: vector(object.scale, { x: 1, y: 1, z: 1 }),
        color: COLOR.test(object.color) ? object.color : "#b9a5d4",
        wireframe: object.wireframe === true,
      });
      objectIds.add(object.id);
    }
    scenes.push({
      id: scene.id,
      title: safeString(scene.title, 120) || "Untitled scene",
      duration: Math.round(boundedNumber(scene.duration, settings.duration, 100, settings.duration)),
      layers,
      motion,
      objects3d,
    });
    sceneIds.add(scene.id);
  }
  return {
    schema: SCHEMA,
    id: input.id,
    title: safeString(input.title, 120) || "Untitled Aahana project",
    createdAt: safeString(input.createdAt, 40),
    updatedAt: safeString(input.updatedAt, 40),
    settings,
    assets,
    scenes,
  };
}

export function addStudioAsset(projectInput, assetInput) {
  const project = validateStudioProject(projectInput);
  if (!project || !isRecord(assetInput) || !validId(assetInput.id) || project.assets.some((asset) => asset.id === assetInput.id)) return null;
  const next = {
    ...project,
    updatedAt: safeString(assetInput.createdAt, 40) || new Date().toISOString(),
    assets: [...project.assets, {
      id: assetInput.id,
      kind: assetInput.kind,
      name: assetInput.name,
      mimeType: assetInput.mimeType,
      size: assetInput.size,
      storageKey: assetInput.storageKey,
      createdAt: assetInput.createdAt || new Date().toISOString(),
    }],
  };
  return validateStudioProject(next);
}

export function addStudioScene(projectInput, sceneInput = {}) {
  const project = validateStudioProject(projectInput);
  if (!project || project.scenes.length >= MAX_SCENES) return null;
  const index = project.scenes.length + 1;
  const scene = {
    id: sceneInput.id || `scene-${index}`,
    title: sceneInput.title || `Scene ${index}`,
    duration: sceneInput.duration || project.settings.duration,
    layers: [],
    motion: [],
    objects3d: [],
  };
  return validateStudioProject({ ...project, updatedAt: new Date().toISOString(), scenes: [...project.scenes, scene] });
}

export function serializeStudioProject(input) {
  const project = validateStudioProject(input);
  if (!project) throw new TypeError("Invalid Aahana project. Check asset and scene references.");
  return JSON.stringify(project, null, 2);
}
