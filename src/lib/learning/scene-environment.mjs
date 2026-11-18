export const SCENE_ENVIRONMENTS = Object.freeze({
  space: Object.freeze({
    background: 0x050a18, fog: 0x050a18, fogDensity: 0.004,
    sky: 0x9dbbe8, ground: 0x0d1224, hemisphere: 1.15,
    key: 0xffe3bd, keyIntensity: 2.6, fill: 0x6caeff, fillIntensity: 0.8,
    rim: 0x7c85ff, rimIntensity: 1.8, accent: 0x6caeff, accentIntensity: 0.7,
    cameraZ: 5.8, stars: true,
  }),
  chemistry: Object.freeze({
    background: 0x100b21, fog: 0x100b21, fogDensity: 0.007,
    sky: 0xb6a7ee, ground: 0x171027, hemisphere: 1.5,
    key: 0xe6dcff, keyIntensity: 3, fill: 0x72d5f3, fillIntensity: 1.15,
    rim: 0xd18cff, rimIntensity: 1.5, accent: 0x8f78ff, accentIntensity: 0.7,
    cameraZ: 5.2, stars: false,
  }),
  biology: Object.freeze({
    background: 0x071a1a, fog: 0x071a1a, fogDensity: 0.006,
    sky: 0xa5e5d4, ground: 0x101e20, hemisphere: 1.6,
    key: 0xffd5c5, keyIntensity: 2.8, fill: 0x7ed7c0, fillIntensity: 1.2,
    rim: 0x77aaff, rimIntensity: 1.5, accent: 0x61d9bb, accentIntensity: 0.7,
    cameraZ: 5.6, stars: false,
  }),
  earth: Object.freeze({
    background: 0x101b24, fog: 0x101b24, fogDensity: 0.009,
    sky: 0xd3e7ff, ground: 0x253b36, hemisphere: 1.5,
    key: 0xffe1b8, keyIntensity: 2.9, fill: 0x9bd3ee, fillIntensity: 1,
    rim: 0x9dbbff, rimIntensity: 1.2, accent: 0x9bd3ee, accentIntensity: 0.6,
    cameraZ: 5.8, stars: false,
  }),
  engineering: Object.freeze({
    background: 0x111827, fog: 0x111827, fogDensity: 0.006,
    sky: 0xb9d7ff, ground: 0x172334, hemisphere: 1.35,
    key: 0xffd7a2, keyIntensity: 3.1, fill: 0x80c9ed, fillIntensity: 1.1,
    rim: 0x91aaff, rimIntensity: 1.5, accent: 0x68b9e6, accentIntensity: 0.65,
    cameraZ: 5.5, stars: false,
  }),
  geometry: Object.freeze({
    background: 0x171326, fog: 0x171326, fogDensity: 0.006,
    sky: 0xd9c9f5, ground: 0x211a30, hemisphere: 1.5,
    key: 0xffe0b8, keyIntensity: 3.2, fill: 0xa4c8ff, fillIntensity: 1,
    rim: 0xc6a2ff, rimIntensity: 1.7, accent: 0x9b82ff, accentIntensity: 0.6,
    cameraZ: 5.5, stars: false,
  }),
});

const MODEL_ENVIRONMENT = Object.freeze({
  "solar-system": "space",
  planet: "space",
  molecule: "chemistry",
  atom: "chemistry",
  dna: "biology",
  cell: "biology",
  "plant-cell": "biology",
  heart: "biology",
  terrain: "earth",
  ecosystem: "earth",
  engine: "engineering",
  cart: "engineering",
  bridge: "engineering",
  cube: "geometry",
  pyramid: "geometry",
});

export function getSceneEnvironment(modelId) {
  return SCENE_ENVIRONMENTS[MODEL_ENVIRONMENT[modelId]] || SCENE_ENVIRONMENTS.geometry;
}
