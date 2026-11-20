import test from "node:test";
import assert from "node:assert/strict";
import { summarizeLearningProgress, validateLearningOutcomes } from "./learner-progress-policy.mjs";

test("accepts bounded, privacy-minimised learning outcomes", () => {
  const outcomes = [{ conceptId: "fractions:halves", correct: true, misconceptionId: null, attempt: 1, hintUsed: false }];
  assert.equal(validateLearningOutcomes(outcomes).length, 1);
});

test("rejects free text, malformed identifiers and oversized outcome sets", () => {
  assert.equal(validateLearningOutcomes([{ conceptId: "learner name", correct: true }]), null);
  assert.equal(validateLearningOutcomes([{ conceptId: "concept", correct: "yes" }]), null);
  assert.equal(validateLearningOutcomes(Array.from({ length: 101 }, (_, i) => ({ conceptId: "c" + i, correct: false }))), null);
});

test("classifies repeated misconceptions as needs-review", () => {
  const summary = summarizeLearningProgress([
    { conceptId: "fractions", correct: false, misconceptionId: "part-whole", attempt: 1 },
    { conceptId: "fractions", correct: false, misconceptionId: "part-whole", attempt: 2 },
  ]);
  assert.equal(summary.concepts[0].status, "needs-review");
  assert.equal(summary.concepts[0].nextStep, "re-explain-with-a-different-example");
});

test("classifies sustained accuracy as secure and suggests transfer", () => {
  const summary = summarizeLearningProgress([
    { conceptId: "fractions", correct: true, attempt: 1 },
    { conceptId: "fractions", correct: true, attempt: 1 },
    { conceptId: "fractions", correct: true, attempt: 1 },
  ]);
  assert.equal(summary.concepts[0].status, "secure");
  assert.equal(summary.concepts[0].nextStep, "offer-a-transfer-challenge");
});

test("fails closed for empty or invalid progress", () => {
  assert.equal(summarizeLearningProgress([]), null);
  assert.equal(summarizeLearningProgress([{ conceptId: "x", correct: 1 }]), null);
});
