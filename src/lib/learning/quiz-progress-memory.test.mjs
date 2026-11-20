import test from "node:test";
import assert from "node:assert/strict";
import { LEARNING_QUIZ_PREFIX, parseLearningQuizProgress, serializeLearningQuizProgress, validateLearningQuizProgress } from "./quiz-progress-memory.mjs";

const sample = {
  title: "Fractions challenge",
  subject: "Mathematics",
  gradeBand: "middle",
  curriculum: "Karnataka State Board",
  language: "English",
  outcomes: [
    { conceptId: "question-1", correct: false, misconceptionId: "question-1-choice-2", attempt: 1 },
    { conceptId: "question-1", correct: true, attempt: 2, hintUsed: true },
    { conceptId: "question-2", correct: true, attempt: 1 },
  ],
};

test("validates compact quiz progress without retaining question or answer text", () => {
  const result = validateLearningQuizProgress(sample);
  assert.equal(result.questions, 2);
  assert.equal(result.correct, 2);
  assert.equal(result.attempts, 3);
  assert.equal(result.hintsUsed, 1);
  assert.equal("questionText" in result, false);
});

test("rejects malformed profiles, unbounded outcomes and invalid quiz sizes", () => {
  assert.equal(validateLearningQuizProgress(null), null);
  assert.equal(validateLearningQuizProgress({ ...sample, subject: "" }), null);
  assert.equal(validateLearningQuizProgress({ ...sample, outcomes: [] }), null);
  assert.equal(validateLearningQuizProgress({ ...sample, outcomes: Array.from({ length: 101 }, () => sample.outcomes[0]) }), null);
  assert.equal(validateLearningQuizProgress({ ...sample, outcomes: Array.from({ length: 51 }, (_, i) => ({ conceptId: "q-" + i, correct: true })) }), null);
});

test("accepts progress for the full 20-question Student Mode quiz", () => {
  const outcomes = Array.from({ length: 20 }, (_, index) => ({
    conceptId: "question-" + (index + 1),
    correct: index % 2 === 0,
  }));
  const result = validateLearningQuizProgress({ ...sample, outcomes });
  assert.equal(result.questions, 20);
  assert.equal(result.correct, 10);
});

test("round-trips only marked and valid quiz progress records", () => {
  const progress = validateLearningQuizProgress(sample);
  const serialized = serializeLearningQuizProgress(progress);
  assert.ok(serialized.startsWith(LEARNING_QUIZ_PREFIX));
  assert.equal(parseLearningQuizProgress(serialized).title, sample.title);
  assert.equal(parseLearningQuizProgress("ordinary memory"), null);
  assert.equal(parseLearningQuizProgress(LEARNING_QUIZ_PREFIX + "{broken"), null);
});
