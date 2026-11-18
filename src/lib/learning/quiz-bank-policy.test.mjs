import test from "node:test";
import assert from "node:assert/strict";
import {
  createQuizPackFingerprint,
  createQuizPackKey,
  removeDuplicateQuizPacks,
  quizBankPolicyVersion,
  validateQuizPack,
} from "./quiz-bank-policy.mjs";

test("quiz pack keys are stable across whitespace and case differences", () => {
  const first = createQuizPackKey({
    subject: " Physics ", topic: "Forces", gradeBand: "Middle",
    curriculum: "CBSE", language: "English", difficulty: "Mixed",
  });
  const second = createQuizPackKey({
    subject: "physics", topic: " forces ", gradeBand: "middle",
    curriculum: "cbse", language: "english", difficulty: "mixed",
  });
  assert.equal(first, second);
  assert.match(first, /^quiz:v1:/);
});

test("quiz pack keys separate grade, curriculum, language and difficulty", () => {
  const base = { subject: "Biology", topic: "Cells", gradeBand: "Middle", curriculum: "CBSE", language: "English", difficulty: "Mixed" };
  assert.notEqual(createQuizPackKey(base), createQuizPackKey({ ...base, gradeBand: "College" }));
  assert.notEqual(createQuizPackKey(base), createQuizPackKey({ ...base, curriculum: "ICSE" }));
  assert.notEqual(createQuizPackKey(base), createQuizPackKey({ ...base, language: "Kannada" }));
  assert.notEqual(createQuizPackKey(base), createQuizPackKey({ ...base, difficulty: "Advanced" }));
});

test("question fingerprints ignore harmless punctuation, case and option ordering", () => {
  const a = [{ question: "What is FORCE?", options: ["Push", "Pull", "Mass", "Speed"] }];
  const b = [{ question: "what is force", options: ["Speed", "Mass", "Pull", "Push"] }];
  assert.equal(createQuizPackFingerprint(a), createQuizPackFingerprint(b));
});

test("invalid and out-of-range packs cannot enter deduplication", () => {
  assert.equal(createQuizPackFingerprint([]), null);
  assert.equal(createQuizPackFingerprint(Array.from({ length: 9 }, (_, i) => ({ question: `Q${i}` }))), null);
  assert.equal(createQuizPackFingerprint(Array.from({ length: 21 }, (_, i) => ({ question: `Q${i}` }))), null);
  assert.equal(createQuizPackFingerprint([{ options: ["A"] }]), null);
  const validQuestions = Array.from({ length: 10 }, (_, i) => ({ question: `Valid question ${i + 1}`, options: ["A", "B", "C", "D"] }));
  assert.deepEqual(removeDuplicateQuizPacks([{ questions: [] }, { questions: validQuestions }]), [
    { questions: validQuestions, fingerprint: createQuizPackFingerprint(validQuestions) },
  ]);
});

test("duplicate packs are removed against stored fingerprints and within a batch", () => {
  const pack = { title: "Cells", questions: Array.from({ length: 10 }, (_, index) => ({ question: `What is cell concept ${index + 1}?`, options: ["Unit", "Planet", "Star", "Atom"] })) };
  const fingerprint = createQuizPackFingerprint(pack.questions);
  assert.deepEqual(removeDuplicateQuizPacks([pack, pack], [fingerprint]), []);
  const result = removeDuplicateQuizPacks([pack, pack]);
  assert.equal(result.length, 1);
  assert.equal(result[0].fingerprint, fingerprint);
});

test("policy version is explicit for future catalogue migrations", () => {
  assert.equal(quizBankPolicyVersion, 1);
});

function validPack(count = 10) {
  return {
    type: "aahana_quiz_v1",
    title: "Forces and motion",
    questions: Array.from({ length: count }, (_, index) => ({
      question: `Which idea describes force number ${index + 1}?`,
      options: ["A push or pull", "A colour", "A temperature", "A distance"],
      correctIndex: 0,
      explanation: "A force is a push or pull that can change motion.",
      hint: "Think about what can start or stop an object's movement.",
      visual: "3d-cart",
    })),
  };
}

test("quiz validator accepts a complete 10-question pack and attaches a fingerprint", () => {
  const result = validateQuizPack(validPack());
  assert.equal(result?.questions.length, 10);
  assert.match(result?.fingerprint || "", /^[a-f0-9]{16}$/);
});

test("quiz validator preserves full teaching explanations and rejects oversized fields", () => {
  const pack = validPack();
  const explanation = "A detailed explanation. ".repeat(18);
  pack.questions[0].explanation = explanation;
  const result = validateQuizPack(pack);
  assert.equal(result?.questions[0].explanation, explanation.replace(/\\s+/g, " ").trim());

  const oversized = validPack();
  oversized.questions[0].explanation = "x".repeat(1201);
  assert.equal(validateQuizPack(oversized), null);

  const oversizedHint = validPack();
  oversizedHint.questions[0].hint = "x".repeat(301);
  assert.equal(validateQuizPack(oversizedHint), null);
});

test("quiz validator rejects too few or too many questions", () => {
  assert.equal(validateQuizPack(validPack(9)), null);
  assert.equal(validateQuizPack(validPack(21)), null);
  assert.equal(validateQuizPack(validPack(20))?.questions.length, 20);
});

test("quiz validator rejects duplicate stems even when phrasing case differs", () => {
  const pack = validPack();
  pack.questions[1].question = pack.questions[0].question.toUpperCase();
  assert.equal(validateQuizPack(pack), null);
});

test("quiz validator rejects duplicate options after normalization", () => {
  const pack = validPack();
  pack.questions[0].options = ["A push or pull", "a push or pull!", "A colour", "A distance"];
  assert.equal(validateQuizPack(pack), null);
});

test("quiz validator rejects invalid answer indexes, missing teaching feedback and unknown visuals", () => {
  const invalidAnswer = validPack();
  invalidAnswer.questions[0].correctIndex = 4;
  assert.equal(validateQuizPack(invalidAnswer), null);

  const noHint = validPack();
  noHint.questions[0].hint = "  ";
  assert.equal(validateQuizPack(noHint), null);

  const unknownVisual = validPack();
  unknownVisual.questions[0].visual = "3d-random-model";
  assert.equal(validateQuizPack(unknownVisual), null);
});
