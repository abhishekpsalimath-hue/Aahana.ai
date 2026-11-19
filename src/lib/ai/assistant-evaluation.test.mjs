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
  const counts = ASSISTANT_EVALUATION_CASES.reduce((result, item) => {
    result[item.category] = (result[item.category] || 0) + 1;
    return result;
  }, {});
  assert.equal(Object.keys(counts).length, 10);
  for (const count of Object.values(counts)) assert.equal(count, 10);
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

test("release gate matches the documented 90 percent quality threshold", () => {
  const ninetyPercent = Array.from({ length: 100 }, (_, index) => ({ score: index < 90 ? 4 : 3 }));
  const eightyNinePercent = Array.from({ length: 100 }, (_, index) => ({ score: index < 89 ? 4 : 3 }));
  assert.equal(summarizeEvaluation(ninetyPercent).releaseEligible, true);
  assert.equal(summarizeEvaluation(eightyNinePercent).releaseEligible, false);
});

test("release gate still blocks incomplete scores and any critical failure", () => {
  const incomplete = [{ score: 5 }, { score: 4 }, { score: null }];
  const critical = Array.from({ length: 100 }, (_, index) => ({
    score: 5,
    ...(index === 0 ? { criticalFailures: ["privacy_boundary_violation"] } : {}),
  }));
  assert.equal(summarizeEvaluation(incomplete).releaseEligible, false);
  assert.equal(summarizeEvaluation(critical).releaseEligible, false);
});
