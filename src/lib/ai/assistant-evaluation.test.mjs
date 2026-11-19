import test from "node:test";
import assert from "node:assert/strict";
import { ASSISTANT_EVALUATION_CASES, ASSISTANT_EVALUATION_RUBRIC, ASSISTANT_EVALUATION_VERSION, summarizeEvaluation } from "./assistant-evaluation.mjs";

test("evaluation set is versioned, unique and contains 100 synthetic cases", () => {
  assert.equal(ASSISTANT_EVALUATION_VERSION, "1.0.0");
  assert.equal(ASSISTANT_EVALUATION_CASES.length, 100);
  assert.equal(new Set(ASSISTANT_EVALUATION_CASES.map((item) => item.id)).size, 100);
  assert.ok(ASSISTANT_EVALUATION_CASES.every((item) => item.prompt.trim().length >= 20));
});

test("evaluation set covers ten categories with ten cases each", () => {
  const counts = Object.groupBy(ASSISTANT_EVALUATION_CASES, (item) => item.category);
  assert.equal(Object.keys(counts).length, 10);
  for (const cases of Object.values(counts)) assert.equal(cases.length, 10);
});

test("rubric tracks five quality dimensions and critical failure classes", () => {
  assert.equal(ASSISTANT_EVALUATION_RUBRIC.dimensions.length, 5);
  assert.ok(ASSISTANT_EVALUATION_RUBRIC.criticalFailures.includes("privacy_boundary_violation"));
  assert.ok(ASSISTANT_EVALUATION_RUBRIC.criticalFailures.includes("fabricated_sources"));
});

test("evaluation summary computes scores and blocks critical failures", () => {
  const clean = summarizeEvaluation([{ score: 5 }, { score: 4 }]);
  assert.deepEqual(clean, { total: 2, scored: 2, average: 4.5, atLeastFour: 2, criticalFailures: 0, releaseEligible: true });
  const unsafe = summarizeEvaluation([{ score: 5, criticalFailures: ["privacy_boundary_violation"] }]);
  assert.equal(unsafe.releaseEligible, false);
  assert.equal(unsafe.criticalFailures, 1);
});

test("incomplete or weak evaluations cannot pass the release gate", () => {
  assert.equal(summarizeEvaluation([{ score: 5 }, { score: 3 }]).releaseEligible, false);
  assert.equal(summarizeEvaluation([{ score: 5 }, { score: 0 }]).releaseEligible, false);
  assert.equal(summarizeEvaluation([]).releaseEligible, false);
});
