import test from "node:test";
import assert from "node:assert/strict";
import { getReferenceImageEvaluationDimensions, scoreReferenceImageEdit } from "./reference-image-evaluation.mjs";

const strongScores = {
  identity: 5,
  anatomy: 4,
  requestedChange: 5,
  preservation: 4,
  composition: 4,
  text: null,
};

test("evaluation dimensions expose six independently weighted quality checks", () => {
  const dimensions = getReferenceImageEvaluationDimensions();
  assert.deepEqual(dimensions.map(({ key }) => key), [
    "identity", "anatomy", "requestedChange", "preservation", "composition", "text",
  ]);
  assert.equal(dimensions.reduce((sum, item) => sum + item.weight, 0), 100);
  assert.equal(dimensions.filter((item) => item.critical).length, 4);
});

test("strong result passes and excludes non-applicable text from weighted score", () => {
  const result = scoreReferenceImageEdit(strongScores);
  assert.equal(result.complete, true);
  assert.equal(result.verdict, "pass");
  assert.equal(result.weightedScore, 4.5);
  assert.equal(result.scores.text, null);
});

test("high average cannot hide a critical identity failure", () => {
  const result = scoreReferenceImageEdit({ ...strongScores, identity: 2 });
  assert.equal(result.verdict, "revise");
  assert.deepEqual(result.failedCritical, ["identity"]);
});

test("high critical scores still require the overall weighted threshold", () => {
  const result = scoreReferenceImageEdit({
    identity: 4,
    anatomy: 4,
    requestedChange: 4,
    preservation: 4,
    composition: 1,
    text: 1,
  });
  assert.equal(result.verdict, "revise");
  assert.ok(result.weightedScore < 4);
});

test("missing critical review dimensions produce an incomplete result", () => {
  const result = scoreReferenceImageEdit({
    identity: 5,
    anatomy: null,
    requestedChange: 4,
    preservation: 4,
    composition: 4,
    text: null,
  });
  assert.equal(result.complete, false);
  assert.equal(result.verdict, "incomplete");
  assert.deepEqual(result.missingCritical, ["anatomy"]);
});

test("invalid scores and unknown dimensions are rejected", () => {
  assert.equal(scoreReferenceImageEdit({ ...strongScores, identity: 6 }), null);
  assert.equal(scoreReferenceImageEdit({ ...strongScores, identity: 3.5 }), null);
  assert.equal(scoreReferenceImageEdit({ ...strongScores, surprise: 5 }), null);
  assert.equal(scoreReferenceImageEdit(null), null);
});

test("every critical dimension must be present before a pass can be awarded", () => {
  const result = scoreReferenceImageEdit({
    identity: null,
    anatomy: 5,
    requestedChange: 5,
    preservation: 5,
    composition: 5,
    text: 5,
  });
  assert.equal(result.verdict, "incomplete");
  assert.deepEqual(result.missingCritical, ["identity"]);
});
