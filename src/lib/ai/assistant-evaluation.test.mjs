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
    criticalFailures: [],
    scores: Object.fromEntries(
      ASSISTANT_EVALUATION_RUBRIC.dimensions.map((dimension) => [dimension, scoreForIndex(index, dimension)])
    ),
  }));

test("evaluation set is versioned, unique and contains 100 synthetic cases", () => {
  assert.equal(ASSISTANT_EVALUATION_VERSION, "1.1.0");
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

test("only a complete 100-case, five-dimension benchmark can pass", () => {
  const clean = summarizeEvaluation(scoredCases());
  assert.deepEqual(clean, {
    total: 100,
    expected: 100,
    scored: 100,
    dimensionsPerCase: 5,
    dimensionScores: 500,
    average: 5,
    dimensionAverages: {
      correctness_and_evidence: 5,
      completeness_and_relevance: 5,
      reasoning_quality: 5,
      clarity_and_language_match: 5,
      honesty_about_uncertainty: 5,
    },
    atLeastFour: 100,
    criticalFailures: 0,
    releaseEligible: true,
  });
  assert.deepEqual(clean.dimensionAverages, {
    correctness_and_evidence: 5,
    completeness_and_relevance: 5,
    reasoning_quality: 5,
    clarity_and_language_match: 5,
    honesty_about_uncertainty: 5,
  });
  assert.deepEqual(summarizeEvaluation([]).dimensionAverages, {
    correctness_and_evidence: null,
    completeness_and_relevance: null,
    reasoning_quality: null,
    clarity_and_language_match: null,
    honesty_about_uncertainty: null,
  });
  assert.equal(summarizeEvaluation(scoredCases().slice(0, 99)).releaseEligible, false);
  assert.equal(summarizeEvaluation([]).releaseEligible, false);
});

test("dimension averages expose uneven quality instead of hiding it in the overall score", () => {
  const results = scoredCases();
  results.forEach((item) => {
    item.scores.correctness_and_evidence = 5;
    item.scores.completeness_and_relevance = 4;
    item.scores.reasoning_quality = 3;
    item.scores.clarity_and_language_match = 2;
    item.scores.honesty_about_uncertainty = 1;
  });
  const summary = summarizeEvaluation(results);
  assert.equal(summary.average, 3);
  assert.deepEqual(summary.dimensionAverages, {
    correctness_and_evidence: 5,
    completeness_and_relevance: 4,
    reasoning_quality: 3,
    clarity_and_language_match: 2,
    honesty_about_uncertainty: 1,
  });
  assert.equal(summary.atLeastFour, 0);
  assert.equal(summary.releaseEligible, false);
});

test("90 percent of case averages at four passes while 89 percent fails", () => {
  const ninetyPercent = summarizeEvaluation(scoredCases((index) => index < 90 ? 4 : 3));
  const eightyNinePercent = summarizeEvaluation(scoredCases((index) => index < 89 ? 4 : 3));
  assert.equal(ninetyPercent.releaseEligible, true);
  assert.equal(ninetyPercent.atLeastFour, 90);
  assert.equal(eightyNinePercent.releaseEligible, false);
  assert.equal(eightyNinePercent.atLeastFour, 89);
});

test("all five rubric dimensions are required and must be between one and five", () => {
  const missingDimension = scoredCases();
  delete missingDimension[0].scores.reasoning_quality;
  const invalidDimension = scoredCases();
  invalidDimension[0].scores.correctness_and_evidence = 6;
  const fractionalDimension = scoredCases();
  fractionalDimension[0].scores.clarity_and_language_match = 4.5;
  for (const results of [missingDimension, invalidDimension, fractionalDimension]) {
    assert.equal(summarizeEvaluation(results).releaseEligible, false);
  }
});

test("duplicate, missing, unknown or invalid case results cannot pass", () => {
  const duplicate = scoredCases();
  duplicate[99] = { ...duplicate[0] };
  const missingId = scoredCases();
  delete missingId[0].id;
  const unknownId = scoredCases();
  unknownId[0].id = "not-in-benchmark";
  for (const results of [duplicate, missingId, unknownId]) {
    assert.equal(summarizeEvaluation(results).releaseEligible, false);
  }
});

test("every case must explicitly report known critical-failure results", () => {
  const missing = scoredCases();
  delete missing[0].criticalFailures;
  const unknown = scoredCases();
  unknown[0].criticalFailures = ["unrecognized_failure_code"];
  for (const results of [missing, unknown]) {
    assert.equal(summarizeEvaluation(results).releaseEligible, false);
  }
});

test("any declared critical failure blocks release even when every dimension scores five", () => {
  const results = scoredCases();
  results[0].criticalFailures = ["privacy_boundary_violation"];
  const summary = summarizeEvaluation(results);
  assert.equal(summary.criticalFailures, 1);
  assert.equal(summary.releaseEligible, false);
});

test("summary reports partial scoring without treating it as a pass", () => {
  const results = scoredCases();
  results[0].scores.honesty_about_uncertainty = null;
  const summary = summarizeEvaluation(results);
  assert.equal(summary.total, 100);
  assert.equal(summary.scored, 99);
  assert.equal(summary.dimensionScores, 495);
  assert.equal(summary.releaseEligible, false);
});

test("case average, not one strong dimension, determines the four-out-of-five threshold", () => {
  const results = scoredCases();
  results[0].scores = {
    correctness_and_evidence: 5,
    completeness_and_relevance: 5,
    reasoning_quality: 3,
    clarity_and_language_match: 3,
    honesty_about_uncertainty: 3,
  };
  const summary = summarizeEvaluation(results);
  assert.equal(summary.atLeastFour, 99);
  assert.equal(summary.releaseEligible, true);
});
