import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const routePath = fileURLToPath(new URL("../../app/api/chat/route.js", import.meta.url));
const studioPath = fileURLToPath(new URL("../../app/learn/learning-studio.jsx", import.meta.url));
const route = readFileSync(routePath, "utf8");
const studio = readFileSync(studioPath, "utf8");

test("chat API accepts the dedicated learn mode and validates learner profile fields", () => {
  assert.match(route, /"improve",\s*"learn"/);
  assert.match(route, /allowedGradeBands/);
  assert.match(route, /allowedLearningModes/);\n  assert.match(route, /allowedLearningSubjects/);\n  assert.match(route, /\\p\{L\}/);
  assert.match(route, /mode === "learn" \?/);
  assert.match(route, /learningProfile\.language/);
});

test("learning instructions are included in the actual model system prompt", () => {
  const start = route.indexOf("const systemPrompt = [");
  const end = route.indexOf("].join(\" \");", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const systemPrompt = route.slice(start, end);
  for (const phrase of [
    "Aahana Learning Studio",
    "Adapt the vocabulary, examples",
    "wait for the learner's attempt",
    "Correct misconceptions gently",
    "Never pretend media was created",
  ]) assert.ok(systemPrompt.includes(phrase), `Missing learning policy: ${phrase}`);
});

test("student studio exposes all six agreed learning experiences", () => {
  for (const phrase of [
    "Story Mode", "Visual Explainer", "Play & Solve",
    "Adventure Mode", "Talk & Learn", "Create & Experiment",
  ]) assert.ok(studio.includes(phrase), `Missing learning experience: ${phrase}`);
  assert.match(studio, /Learning level/);
  assert.match(studio, /Learning language/);
  assert.match(studio, /What are you exploring\?/);
});

test("learning sessions use the authenticated chat endpoint and persist under learn mode", () => {
  assert.match(studio, /fetch\("\/api\/chat"/);
  assert.match(studio, /mode: "learn"/);
  assert.match(studio, /learningProfile: profile/);
});
