import test from "node:test";
import assert from "node:assert/strict";
import {
  addStudioAsset,
  addStudioScene,
  createStudioProject,
  serializeStudioProject,
  validateStudioProject,
} from "./project-engine.mjs";

test("creates a versioned shared project with one editable scene", () => {
  const project = createStudioProject({ id: "lesson-1", title: "Solar system" });
  assert.equal(project.schema, "aahana-project/v1");
  assert.equal(project.scenes.length, 1);
  assert.equal(validateStudioProject(project).title, "Solar system");
});

test("adds reusable assets and validates scene references", () => {
  const project = createStudioProject();
  const withAsset = addStudioAsset(project, {
    id: "earth-texture", kind: "image", name: "Earth texture",
    mimeType: "image/png", size: 1024, storageKey: "assets/earth-texture",
  });
  assert.equal(withAsset.assets.length, 1);
  const withLayer = {
    ...withAsset,
    scenes: [{
      ...withAsset.scenes[0],
      layers: [{ id: "earth-layer", type: "image", assetId: "earth-texture", x: 0, y: 0, width: 500, height: 500 }],
    }],
  };
  assert.equal(validateStudioProject(withLayer).scenes[0].layers[0].assetId, "earth-texture");
  assert.equal(validateStudioProject({ ...withLayer, scenes: [{ ...withLayer.scenes[0], layers: [{ ...withLayer.scenes[0].layers[0], assetId: "missing" }] }] }), null);
});

test("rejects unsafe or oversized project structures", () => {
  const project = createStudioProject();
  assert.equal(validateStudioProject({ ...project, schema: "unknown/v9" }), null);
  assert.equal(validateStudioProject({ ...project, assets: Array(501).fill({}) }), null);
  assert.equal(validateStudioProject({ ...project, scenes: [{ ...project.scenes[0], objects3d: [{ id: "bad", geometry: "script" }] }] }), null);
});

test("validates motion tracks against existing layers and ordered keyframes", () => {
  const project = createStudioProject();
  const scene = {
    ...project.scenes[0],
    layers: [{ id: "planet", type: "shape" }],
    motion: [{ id: "orbit", targetLayerId: "planet", property: "x", keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 100, easing: "ease-in-out" }] }],
  };
  assert.equal(validateStudioProject({ ...project, scenes: [scene] }).scenes[0].motion.length, 1);
  assert.equal(validateStudioProject({ ...project, scenes: [{ ...scene, motion: [{ ...scene.motion[0], keyframes: [{ time: 1000, value: 1 }, { time: 500, value: 2 }] }] }] }), null);
});

test("adds scenes and serializes only validated project data", () => {
  const project = addStudioScene(createStudioProject(), { id: "scene-2", title: "Orbit" });
  assert.equal(project.scenes.length, 2);
  assert.match(serializeStudioProject(project), /aahana-project\/v1/);
  assert.throws(() => serializeStudioProject({ broken: true }), TypeError);
});
