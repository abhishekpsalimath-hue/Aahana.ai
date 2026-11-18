import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLearningSubject } from "./subject-policy.mjs";

test("keeps open-ended learner topics", () => {
  assert.equal(normalizeLearningSubject("Marine robotics"), "Marine robotics");
  assert.equal(normalizeLearningSubject("  Kannada literature  "), "Kannada literature");
  assert.equal(normalizeLearningSubject("AI, ethics and public policy"), "AI, ethics and public policy");
});

test("uses the explore fallback for missing or unsafe-length subjects", () => {
  assert.equal(normalizeLearningSubject(undefined), "Anything / explore");
  assert.equal(normalizeLearningSubject("   "), "Anything / explore");
  assert.equal(normalizeLearningSubject("x".repeat(81)), "Anything / explore");
});

test("accepts an 80-character subject", () => {
  const subject = "x".repeat(80);
  assert.equal(normalizeLearningSubject(subject), subject);
});
