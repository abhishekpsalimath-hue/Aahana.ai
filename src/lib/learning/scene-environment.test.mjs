import test from "node:test";
import assert from "node:assert/strict";
import { getSceneEnvironment, SCENE_ENVIRONMENTS } from "./scene-environment.mjs";

test("learning models receive a subject-appropriate visual environment", () => {
  assert.equal(getSceneEnvironment("solar-system"), SCENE_ENVIRONMENTS.space);
  assert.equal(getSceneEnvironment("molecule"), SCENE_ENVIRONMENTS.chemistry);
  assert.equal(getSceneEnvironment("plant-cell"), SCENE_ENVIRONMENTS.biology);
  assert.equal(getSceneEnvironment("terrain"), SCENE_ENVIRONMENTS.earth);
  assert.equal(getSceneEnvironment("bridge"), SCENE_ENVIRONMENTS.engineering);
  assert.equal(getSceneEnvironment("cube"), SCENE_ENVIRONMENTS.geometry);
});

test("space keeps its star field while classroom and lab scenes do not", () => {
  assert.equal(getSceneEnvironment("planet").stars, true);
  for (const model of ["molecule", "cell", "terrain", "engine", "cube"]) {
    assert.equal(getSceneEnvironment(model).stars, false, model);
  }
});

test("every environment has complete lighting, camera and atmosphere settings", () => {
  for (const [name, profile] of Object.entries(SCENE_ENVIRONMENTS)) {
    for (const key of ["background", "fog", "fogDensity", "sky", "ground", "hemisphere", "key", "keyIntensity", "fill", "fillIntensity", "rim", "rimIntensity", "accent", "accentIntensity", "cameraZ", "stars"]) {
      assert.ok(profile[key] !== undefined, name + " is missing " + key);
    }
    assert.ok(profile.cameraZ >= 4 && profile.cameraZ <= 8, name + " camera distance is out of range");
    assert.ok(profile.fogDensity > 0 && profile.fogDensity < 0.02, name + " fog density is out of range");
  }
});

test("unknown models safely use the neutral geometry environment", () => {
  assert.equal(getSceneEnvironment("future-model"), SCENE_ENVIRONMENTS.geometry);
});
