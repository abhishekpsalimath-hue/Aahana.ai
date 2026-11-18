import test from "node:test";
import assert from "node:assert/strict";
import { LEARNING_MEMORY_PREFIX, parseLearningJourney, serializeLearningJourney, validateLearningJourney } from "./learning-memory.js";

const sample = {
  title: "The Water Cycle",
  subject: "Science",
  gradeBand: "middle",
  curriculum: "Karnataka State Board",
  language: "ಕನ್ನಡ",
  sceneCount: 4,
  attempts: 7,
  adaptedScenes: 1,
  exploredScenes: 4,
  scenes: [
    { caption: "Evaporation", alternateExplanationUsed: false },
    { caption: "Condensation", alternateExplanationUsed: true },
    { caption: "Precipitation", alternateExplanationUsed: false },
    { caption: "Collection", alternateExplanationUsed: false },
  ],
};

test("validates and bounds a completed learning journey", () => {
  const result = validateLearningJourney(sample);
  assert.equal(result.title, sample.title);
  assert.equal(result.exploredScenes, 4);
  assert.equal(result.scenes[1].alternateExplanationUsed, true);
  assert.equal(typeof result.completedAt, "string");
});

test("preserves open-ended subjects up to the Student Mode 80-character limit", () => {
  const subject = "Advanced interdisciplinary marine robotics and autonomous ocean exploration";
  assert.ok(subject.length > 60 && subject.length <= 80);
  const result = validateLearningJourney({ ...sample, subject });
  assert.equal(result.subject, subject);
  assert.equal(validateLearningJourney({ ...sample, subject: "x".repeat(81) }).subject, "x".repeat(80));
});

test("rejects incomplete, unbounded and impossible journey data", () => {
  assert.equal(validateLearningJourney(null), null);
  assert.equal(validateLearningJourney({ ...sample, sceneCount: 1 }), null);
  assert.equal(validateLearningJourney({ ...sample, attempts: 0 }), null);
  assert.equal(validateLearningJourney({ ...sample, exploredScenes: 3 }), null);
  assert.equal(validateLearningJourney({ ...sample, scenes: [{ caption: "Only one", alternateExplanationUsed: false }] }), null);
  assert.equal(validateLearningJourney({ ...sample, title: "" }), null);
});

test("serializes and parses only marked learning journey records", () => {
  const journey = validateLearningJourney(sample);
  const content = serializeLearningJourney(journey);
  assert.ok(content.startsWith(LEARNING_MEMORY_PREFIX));
  assert.equal(parseLearningJourney(content).title, sample.title);
  assert.equal(parseLearningJourney("ordinary user memory"), null);
  assert.equal(parseLearningJourney(LEARNING_MEMORY_PREFIX + "{broken"), null);
});

test("does not treat arbitrary or malformed JSON as a journey", () => {
  assert.equal(parseLearningJourney(LEARNING_MEMORY_PREFIX + JSON.stringify({ title: "Only a title" })), null);
});
