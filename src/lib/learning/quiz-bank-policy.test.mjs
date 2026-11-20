import test from "node:test";
import assert from "node:assert/strict";
import {
  createQuizPackFingerprint,
  createQuizPackKey,
  removeDuplicateQuizPacks,
  validateQuizPack,
} from "./quiz-bank-policy.mjs";

function makePack(overrides = {}) {
  return {
    type: "aahana_quiz_v1",
    title: "Fractions",
    questions: Array.from({ length: 10 }, (_, index) => ({
      question: `What does fraction concept ${index + 1} represent?`,
      options: ["One half", "One third", "One fourth", "One whole"],
      correctIndex: 0,
      explanation: "A fraction describes part of a whole.",
      hint: "Think about equal parts.",
      visual: "fraction",
    })),
    ...overrides,
  };
}

test("accepts a complete supported quiz pack and adds a stable fingerprint", () => {
  const pack = validateQuizPack(makePack());
  assert.equal(pack.questions.length, 10);
  assert.match(pack.fingerprint, /^[a-f0-9]{16}$/);
});

test("rejects unsupported schema and out-of-range question counts", () => {
  assert.equal(validateQuizPack({ ...makePack(), type: "unknown" }), null);
  assert.equal(validateQuizPack({ ...makePack(), questions: [] }), null);
});

test("rejects duplicate question stems and duplicate answer options", () => {
  const duplicateStem = makePack();
  duplicateStem.questions[1].question = duplicateStem.questions[0].question;
  assert.equal(validateQuizPack(duplicateStem), null);

  const duplicateOption = makePack();
  duplicateOption.questions[0].options[1] = duplicateOption.questions[0].options[0];
  assert.equal(validateQuizPack(duplicateOption), null);
});

test("rejects invalid answer indices, unsupported visuals and oversized fields", () => {
  const badIndex = makePack();
  badIndex.questions[0].correctIndex = 4;
  assert.equal(validateQuizPack(badIndex), null);

  const badVisual = makePack();
  badVisual.questions[0].visual = "untrusted-html";
  assert.equal(validateQuizPack(badVisual), null);

  const longHint = makePack();
  longHint.questions[0].hint = "x".repeat(301);
  assert.equal(validateQuizPack(longHint), null);
});

test("fingerprints normalize equivalent question and option ordering", () => {
  const first = makePack().questions;
  const second = first.map((question) => ({ ...question, options: [...question.options].reverse() }));
  assert.equal(createQuizPackFingerprint(first), createQuizPackFingerprint(second));
});

test("duplicate pack removal preserves first-seen order and known fingerprints", () => {
  const first = makePack();
  const duplicate = makePack({ title: "Same content, new title" });
  const unique = makePack({ questions: makePack().questions.map((q, i) => ({ ...q, question: q.question + " extra detail" })) });
  const result = removeDuplicateQuizPacks([first, duplicate, unique]);
  assert.equal(result.length, 2);
  assert.equal(result[0].title, first.title);
  assert.equal(removeDuplicateQuizPacks([first], [createQuizPackFingerprint(first.questions)]).length, 0);
});

test("quiz keys are stable and safely encode learner context", () => {
  const input = { subject: "Math & Science", topic: "Fractions / ratios", gradeBand: "primary", curriculum: "CBSE", language: "en-IN", difficulty: "easy", contentVersion: 2 };
  const key = createQuizPackKey(input);
  assert.equal(key, createQuizPackKey(input));
  assert.ok(key.includes("Math%20%26%20Science"));
  assert.ok(key.includes("Fractions%20%2F%20ratios"));
});
