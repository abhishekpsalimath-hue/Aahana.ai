import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const world = readFileSync(new URL("../../app/learn/interactive-3d-world.jsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../../app/api/chat/route.js", import.meta.url), "utf8");
const studio = readFileSync(new URL("../../app/learn/learning-studio.jsx", import.meta.url), "utf8");

test("3D learning renderer uses adaptive high-quality rendering with a mobile performance ceiling", () => {
  assert.match(world, /powerPreference:\s*"high-performance"/);
  assert.match(world, /constrainedDevice \? 1\.5 : 2/);
  assert.match(world, /ACESFilmicToneMapping/);
  assert.match(world, /PCFSoftShadowMap/);
  assert.match(world, /key\.castShadow = !constrainedDevice/);
  assert.match(world, /object\.receiveShadow = state\.renderer\.shadowMap\.enabled/);
});

test("visual direction asks for cinematic craft while protecting scientific clarity", () => {
  assert.match(route, /premium cinematic science-documentary experience/);
  assert.match(route, /physically plausible key\/fill\/rim lighting/);
  assert.match(route, /polished transitions/);
  assert.match(route, /VFX only when they explain a real process/);
  assert.match(route, /scientific proportions and scale conventions honest/);
});

test("school-grade learning includes a concrete improvement and spaced-revision loop", () => {
  assert.match(route, /GRADE IMPROVEMENT AND EXAM READINESS/);
  assert.match(route, /fully worked example/);
  assert.match(route, /concise marking guide/);
  assert.match(route, /SPACED REVISION/);
  assert.match(route, /about 1 day, 3 days and 7 days/);
  assert.match(route, /learningProfile\.schoolGrade \? \[/);
});

test("school-grade Play & Solve questions include a balanced mix of thinking levels", () => {
  assert.match(route, /foundational recall \(2\)/);
  assert.match(route, /concept understanding \(3\)/);
  assert.match(route, /application \(3\)/);
  assert.match(route, /reasoning \(1\)/);
  assert.match(route, /exam-style transfer question \(1\)/);
});

test("the agreed six learning paths remain unchanged", () => {
  for (const mode of ['"story"', '"visual"', '"play"', '"adventure"', '"talk"', '"experiment"']) {
    assert.ok(studio.includes("id: " + mode), "Missing path " + mode);
  }
});


test("Play & Solve gives each learner a personalised revision list and spaced-practice steps", () => {
  assert.match(studio, /const firstTryCorrect =/);
  assert.match(studio, /const reviewQuestions =/);
  assert.match(studio, /Personal revision guide/);
  assert.match(studio, /Your next discoveries to strengthen/);
  assert.match(studio, /Tomorrow/);
  assert.match(studio, /In 3 days/);
  assert.match(studio, /In 7 days/);
});
