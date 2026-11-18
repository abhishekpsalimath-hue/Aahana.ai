import test from "node:test";
import assert from "node:assert/strict";
import {
  createQuizPackFingerprint,
  createQuizPackKey,
  removeDuplicateQuizPacks,
  quizBankPolicyVersion,
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
  assert.equal(createQuizPackFingerprint(Array.from({ length: 11 }, (_, i) => ({ question: `Q${i}` }))), null);
  assert.equal(createQuizPackFingerprint([{ options: ["A"] }]), null);
  assert.deepEqual(removeDuplicateQuizPacks([{ questions: [] }, { questions: [{ question: "valid question" }] }]), [
    { questions: [{ question: "valid question" }], fingerprint: createQuizPackFingerprint([{ question: "valid question" }]) },
  ]);
});

test("duplicate packs are removed against stored fingerprints and within a batch", () => {
  const pack = { title: "Cells", questions: [{ question: "What is a cell?", options: ["Unit", "Planet"] }] };
  const fingerprint = createQuizPackFingerprint(pack.questions);
  assert.deepEqual(removeDuplicateQuizPacks([pack, pack], [fingerprint]), []);
  const result = removeDuplicateQuizPacks([pack, pack]);
  assert.equal(result.length, 1);
  assert.equal(result[0].fingerprint, fingerprint);
});

test("policy version is explicit for future catalogue migrations", () => {
  assert.equal(quizBankPolicyVersion, 1);
});
