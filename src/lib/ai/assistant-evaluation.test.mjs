import test from "node:test";
import assert from "node:assert/strict";
import {
  ASSISTANT_EVALUATION_CASES,
  ASSISTANT_EVALUATION_RUBRIC,
  ASSISTANT_EVALUATION_VERSION,
  summarizeEvaluation,
} from "./assistant-evaluation.mjs";

const scoredCases = (scoreForIndex = () => 5) =>
  ASSISTANT_EVALUATION_CASES.map((item, index) => ({
    id: item.id,
    score: scoreForIndex(index),
  }));

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

test("only a complete 100-case benchmark can pass", () => {
  const clean = summarizeEvaluation(scoredCases());
  assert.deepEqual(clean, {
    total: 100,
    expected: 100,
    scored: 100,
    average: 5,
    atLeastFour: 100,
    criticalFailures: 0,
    releaseEligible: true,
  });
  assert.equal(summarizeEvaluation(scoredCases().slice(0, 99)).releaseEligible, false);
  assert.equal(summarizeEvaluation([]).releaseEligible, false);
});

test("90 percent passes while 89 percent fails", () => {
  const ninetyPercent = summarizeEvaluation(scoredCases((index) => index < 90 ? 4 : 3));
  const eightyNinePercent = summarizeEvaluation(scoredCases((index) => index < 89 ? 4 : 3));
  assert.equal(ninetyPercent.releaseEligible, true);
  assert.equal(ninetyPercent.atLeastFour, 90);
  assert.equal(eightyNinePercent.releaseEligible, false);
  assert.equal(eightyNinePercent.atLeastFour, 89);
});

test("duplicate, missing, unknown or invalid case results cannot pass", () => {
  const duplicate = scoredCases();
  duplicate[99] = { ...duplicate[0] };
  const missingId = scoredCases();
  delete missingId[0].id;
  const unknownId = scoredCases();
  unknownId[0].id = "not-in-benchmark";
  const invalidScore = scoredCases();
  invalidScore[0].score = 0;

  for (const results of [duplicate, missingId, unknownId, invalidScore]) {
    assert.equal(summarizeEvaluation(results).releaseEligible, false);
  }
});

test("any critical failure blocks release even when every score is five", () => {
  const results = scoredCases();
  results[0].criticalFailures = ["privacy_boundary_violation"];
  const summary = summarizeEvaluation(results);
  assert.equal(summary.criticalFailures, 1);
  assert.equal(summary.releaseEligible, false);
});

test("summary reports partial scoring without treating it as a pass", () => {
  const results = scoredCases();
  results[0].score = null;
  const summary = summarizeEvaluation(results);
  assert.equal(summary.total, 100);
  assert.equal(summary.scored, 99);
  assert.equal(summary.releaseEligible, false);
});
