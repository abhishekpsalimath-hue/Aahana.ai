import test from "node:test";
import assert from "node:assert/strict";
import { summarizeLearningProgress, validateLearningOutcomes } from "./learner-progress-policy.mjs";

test("validates compact learning outcomes and excludes free-text fields", () => {
  const result = validateLearningOutcomes([
    { conceptId: "fractions.equivalence", correct: false, misconceptionId: "same-denominator", hintUsed: true, attempt: 1 },
    { conceptId: "fractions.equivalence", correct: true, misconceptionId: null, hintUsed: false, attempt: 2 },
  ]);
  assert.equal(result.length, 2);
  assert.equal(Object.hasOwn(result[0], "answerText"), false);
});

test("rejects malformed, unbounded and excessive learner outcome data", () => {
  assert.equal(validateLearningOutcomes(null), null);
  assert.equal(validateLearningOutcomes([]), null);
  assert.equal(validateLearningOutcomes([{ conceptId: "math", correct: "yes" }]), null);
  assert.equal(validateLearningOutcomes([{ conceptId: "../private", correct: true }]), null);
  assert.equal(validateLearningOutcomes([{ conceptId: "math", correct: true, attempt: 11 }]), null);
  assert.equal(validateLearningOutcomes(Array.from({ length: 101 }, () => ({ conceptId: "math", correct: true }))), null);
});

test("detects a repeated misconception and recommends a different explanation", () => {
  const summary = summarizeLearningProgress([
    { conceptId: "fractions.equivalence", correct: false, misconceptionId: "same-denominator" },
    { conceptId: "fractions.equivalence", correct: false, misconceptionId: "same-denominator" },
    { conceptId: "fractions.equivalence", correct: true },
  ]);
  assert.equal(summary.concepts[0].status, "needs-review");
  assert.equal(summary.concepts[0].repeatedMisconceptions[0].count, 2);
  assert.equal(summary.concepts[0].nextStep, "re-explain-with-a-different-example");
});

test("marks a concept secure only after repeated strong performance", () => {
  const summary = summarizeLearningProgress([
    { conceptId: "photosynthesis", correct: true },
    { conceptId: "photosynthesis", correct: true },
    { conceptId: "photosynthesis", correct: true },
  ]);
  assert.equal(summary.concepts[0].status, "secure");
  assert.equal(summary.concepts[0].nextStep, "offer-a-transfer-challenge");
});

test("keeps one-off errors in developing state rather than overdiagnosing", () => {
  const summary = summarizeLearningProgress([
    { conceptId: "algebra", correct: false, misconceptionId: "sign-error" },
  ]);
  assert.equal(summary.concepts[0].status, "developing");
});

test("bounds concept cardinality and keeps summary deterministic", () => {
  const tooMany = Array.from({ length: 51 }, (_, index) => ({ conceptId: "concept" + index, correct: true }));
  assert.equal(summarizeLearningProgress(tooMany), null);
  const outcomes = [
    { conceptId: "geometry", correct: true },
    { conceptId: "geometry", correct: false },
    { conceptId: "geometry", correct: true },
  ];
  assert.deepEqual(summarizeLearningProgress(outcomes), summarizeLearningProgress(outcomes));
});
