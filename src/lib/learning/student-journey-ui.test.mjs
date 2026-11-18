import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const studio = readFileSync(new URL("../../app/learn/learning-studio.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../app/learn/learning-studio.css", import.meta.url), "utf8");
const chatRoute = readFileSync(new URL("../../app/api/chat/route.js", import.meta.url), "utf8");

test("Student Mode presents the learning journey before the conversation", () => {
  const hero = studio.indexOf('className="learning-hero student-welcome"');
  const discovery = studio.indexOf('className="learning-discovery"');
  const world = studio.indexOf("<Interactive3DWorld");
  const session = studio.indexOf('className="learning-session"');
  assert.ok(hero >= 0 && discovery > hero && world > discovery && session > world);
  assert.match(studio, /Every question opens/);
  assert.match(studio, /How would you like to explore/);
});

test("all six agreed learning experiences remain available", () => {
  for (const mode of ['"story"', '"visual"', '"play"', '"adventure"', '"talk"', '"experiment"']) {
    assert.ok(studio.includes('id: ' + mode), "Missing learning path " + mode);
  }
  assert.match(studio, /useState\("adventure"\)/);
});

test("Play & Solve reveals one challenge at a time and waits for the learner to continue", () => {
  assert.match(studio, /const item = quiz\.questions\[currentIndex\]/);
  assert.match(studio, /!completed && <section/);
  assert.match(studio, /Next discovery/);
  assert.match(studio, /Finish my journey/);
  assert.doesNotMatch(studio, /quiz\.questions\.map\(\(item, index\)/);
});

test("Play & Solve keeps a complete 10-question default and optional 15 or 20 question requests", () => {
  assert.match(chatRoute, /exactly 10 fresh multiple-choice questions by default/);
  assert.match(chatRoute, /15 or 20 only when explicitly requested/);
  assert.match(studio, /Create a fresh 10-question Play & Solve journey/);
});

test("learning prompts pair cinematic visual direction with evidence-based exam mastery", () => {
  for (const phrase of ["CINEMATIC VISUAL DIRECTION", "camera movement", "key light", "colour grading", "ACADEMIC MASTERY AND EXAM TRANSFER", "active recall", "mark-point structure", "ASSESSMENT QUALITY"]) {
    assert.ok(chatRoute.includes(phrase), "Missing learning-quality guidance: " + phrase);
  }
});

test("journey styling remains responsive and respects reduced-motion preferences", () => {
  assert.match(styles, /\.student-welcome/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
});


test("interactive 3D renderer uses adaptive quality, cinematic three-point lighting and soft shadows", () => {
  const world = readFileSync(new URL("../../app/learn/interactive-3d-world.jsx", import.meta.url), "utf8");
  assert.match(world, /compactDevice/);
  assert.match(world, /renderer\.shadowMap\.enabled = !compactDevice/);
  assert.match(world, /THREE\.PCFSoftShadowMap/);
  assert.match(world, /new THREE\.FogExp2/);
  assert.match(world, /new THREE\.HemisphereLight/);
  assert.match(world, /new THREE\.DirectionalLight\(0xffe6c8/);
  assert.match(world, /new THREE\.DirectionalLight\(0x8dbbff/);
  assert.match(world, /new THREE\.PointLight\(0x6f9fff/);
  assert.match(world, /accentLight\.intensity/);
});

test("3D learning animation pauses for hidden tabs and respects reduced-motion preferences", () => {
  const world = readFileSync(new URL("../../app/learn/interactive-3d-world.jsx", import.meta.url), "utf8");
  assert.match(world, /prefers-reduced-motion: reduce/);
  assert.match(world, /document\.visibilityState !== "hidden"/);
  assert.match(world, /document\.addEventListener\("visibilitychange", onVisibilityChange\)/);
  assert.match(world, /motionQuery\?\.addEventListener\?\.\("change", onMotionChange\)/);
  assert.match(world, /if \(reducedMotion\) drawOnce\(\)/);
  assert.match(world, /cancelAnimationFrame\(frame\)/);
  assert.match(world, /removeEventListener\("visibilitychange", onVisibilityChange\)/);
});

test("physics cart experiment connects force, opposing force and mass through Newton's second law", () => {
  const world = readFileSync(new URL("../../app/learn/interactive-3d-world.jsx", import.meta.url), "utf8");
  assert.match(world, /const netForce = force - friction/);
  assert.match(world, /const acceleration = netForce \/ mass/);
  assert.match(world, /physics-mass/);
  assert.match(world, /Cart mass:/);
  assert.match(world, /Net force =/);
  assert.match(world, /Acceleration =/);
  assert.match(world, /a = Fnet ÷ m/);
  assert.match(world, /not a time-based motion prediction/);
});

test("forest habitat experiment exposes continuous rainfall and pollution controls with qualitative guidance", () => {
  const world = readFileSync(new URL("../../app/learn/interactive-3d-world.jsx", import.meta.url), "utf8");
  assert.match(world, /const rainfall = clamp\(Number\(ecosystem\.rainfall \?\? 70\), 0, 100\)/);
  assert.match(world, /const pollution = clamp\(Number\(ecosystem\.pollution \?\? 15\), 0, 100\)/);
  assert.match(world, /id="habitat-rainfall"/);
  assert.match(world, /id="habitat-pollution"/);
  assert.match(world, /aria-label="Forest habitat experiment"/);
  assert.match(world, /not a measured ecological forecast/);
  assert.match(world, /Freshwater stream/);
  assert.match(world, /Reset experiment/);
});

test("solar system experiment lets learners pause and adjust illustrative orbital motion", () => {
  const world = readFileSync(new URL("../../app/learn/interactive-3d-world.jsx", import.meta.url), "utf8");
  assert.match(world, /orbitSpeedMultiplier = 1/);
  assert.match(world, /orbitSpeed \?\? 1/);
  assert.match(world, /child\.userData\.orbitSpeed \* orbitSpeedMultiplier/);
  assert.match(world, /id="orbit-speed"/);
  assert.match(world, /EXPERIMENT WITH ORBITAL MOTION/);
  assert.match(world, /not a real-time scale model of orbital periods/);
});

test("heart biology lab guides learners through the body-lungs-body circulation pathway", () => {
  const world = readFileSync(new URL("../../app/learn/interactive-3d-world.jsx", import.meta.url), "utf8");
  assert.match(world, /aria-label="Heart and circulation learning lab"/);
  assert.match(world, /heartFlow/);
  assert.match(world, /From body/);
  assert.match(world, /To lungs/);
  assert.match(world, /From lungs/);
  assert.match(world, /Oxygen-poor blood returns from the body/);
  assert.match(world, /oxygen-rich blood back to the left side/);
  assert.match(world, /Restart circulation journey/);
});
