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
  assert.match(route, /allowedLearningModes/);
  assert.match(route, /allowedLearningSubjects/);
  assert.match(route, /allowedCurricula/);
  assert.match(route, /curriculum: allowedCurricula/);
  assert.match(route, /\\p\{L\}/);
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
  assert.match(studio, /Curriculum \/ education board/);
  assert.match(studio, /curriculum, language, learningMode/);
  assert.match(studio, /What are you exploring\?/);
});

test("learning sessions use the authenticated chat endpoint and persist under learn mode", () => {
  assert.match(studio, /fetch\("\/api\/chat"/);
  assert.match(studio, /mode: "learn"/);
  assert.match(studio, /learningProfile: profile/);
});

test("learning studio lists only learn-mode sessions and resumes through the owner-scoped conversation API", () => {
  assert.match(studio, /fetch\("\/api\/conversations"/);
  assert.match(studio, /filter\(\(item\) => item\.mode === "learn"\)/);
  assert.match(studio, /fetch\("\/api\/conversations\/" \+ encodeURIComponent\(id\)/);
  assert.match(studio, /result\.conversation\?\.mode !== "learn"/);
  assert.match(studio, /setMessages\(\(result\.messages \|\| \[\]\)\.map/);
});

test("learner preferences are saved per conversation and restored when resuming on the same device", () => {
  assert.match(studio, /localStorage\.setItem\("aahana:learning-profile:" \+ nextId/);
  assert.match(studio, /localStorage\.getItem\("aahana:learning-profile:" \+ result\.conversation\.id/);
  assert.match(studio, /setGradeBand\(savedProfile\.gradeBand\)/);
  assert.match(studio, /setSubject\(savedProfile\.subject\)/);
  assert.match(studio, /setLearningMode\(savedProfile\.learningMode\)/);
});

test("curriculum selection is restored with the learner profile and handled cautiously by the tutor", () => {
  assert.match(studio, /curricula\.includes\(savedProfile\.curriculum\)/);
  assert.match(studio, /setCurriculum\(savedProfile\.curriculum\)/);
  assert.match(route, /Curriculum: \$\{learningProfile\.curriculum\}/);
  assert.match(route, /Do not claim exact syllabus alignment or exam-board coverage unless verified/);
});

test("Play and Solve requests a strict structured quiz from the tutor", () => {
  assert.match(route, /learningProfile\.learningMode === "play"/);
  assert.match(route, /type set to aahana_quiz_v1/);
  assert.match(route, /correctIndex \(integer 0 to 3\)/);
  assert.match(route, /exactly four distinct strings/);
});

test("Learning Studio validates and renders interactive quizzes with feedback and scoring", () => {
  assert.match(studio, /function readQuizPayload\(content\)/);
  assert.match(studio, /value\?\.type !== "aahana_quiz_v1"/);
  assert.match(studio, /item\.options\.length === 4/);
  assert.match(studio, /Number\.isInteger\(item\.correctIndex\)/);
  assert.match(studio, /function InteractiveQuiz\(\{ quiz \}\)/);
  assert.match(studio, /onClick=\{\(\) => setAnswers/);
  assert.match(studio, /Score: \$\{score\}/);
  assert.match(studio, /Try again/);
});
