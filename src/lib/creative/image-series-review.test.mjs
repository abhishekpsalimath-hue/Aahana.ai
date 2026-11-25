import test from "node:test";
import assert from "node:assert/strict";
import { validateImageSeriesReviews, summarizeImageSeriesReviews, IMAGE_SERIES_REVIEW_DIMENSIONS } from "./image-series-review.mjs";

const scores = {
  subjectContinuity: 5, wardrobeContinuity: 4, paletteContinuity: 4,
  styleContinuity: 5, sceneCoherence: 4,
};
function review(overrides = {}) {
  return {
    seriesId: "series-001", sampleId: "sample-001", model: "offline-fixture",
    reviewer: "reviewer-a", sceneNumber: 1, reviewedAt: "2026-11-25T12:00:00Z",
    scores, notes: "Synthetic metadata only.", ...overrides,
  };
}

test("validates connected scene reviews with a fixed continuity rubric", () => {
  assert.equal(validateImageSeriesReviews([review(), review({ sampleId: "sample-002", sceneNumber: 2 })]).length, 2);
  assert.deepEqual(IMAGE_SERIES_REVIEW_DIMENSIONS, ["subjectContinuity", "wardrobeContinuity", "paletteContinuity", "styleContinuity", "sceneCoherence"]);
});

test("summarizes scene coverage, per-scene scores and series continuity", () => {
  const summary = summarizeImageSeriesReviews([
    review(),
    review({ sampleId: "sample-002", sceneNumber: 2, reviewer: "reviewer-b", scores: { ...scores, subjectContinuity: 3 } }),
    review({ sampleId: "sample-003", sceneNumber: 2, reviewer: "reviewer-a" }),
  ])[0];
  assert.equal(summary.reviewedScenes, 2);
  assert.deepEqual(summary.sceneNumbers, [1, 2]);
  assert.deepEqual(summary.missingSceneNumbers, []);
  assert.equal(summary.reviewCount, 3);
  assert.equal(summary.reviewerCount, 2);
  assert.equal(summary.perScene[1].reviews, 2);
  assert.equal(summary.dimensions.subjectContinuity, 4.33);
});

test("reports gaps in scene sequence rather than silently treating them as complete", () => {
  const summary = summarizeImageSeriesReviews([
    review({ sceneNumber: 1 }),
    review({ sampleId: "sample-003", sceneNumber: 3 }),
  ])[0];
  assert.deepEqual(summary.missingSceneNumbers, [2]);
});

test("rejects single-scene series, duplicate reviewer-scene entries and invalid scene numbers", () => {
  assert.throws(() => validateImageSeriesReviews([review()]), /at least two/);
  assert.throws(() => validateImageSeriesReviews([review(), review()]), /Duplicate reviewer submission/);
  assert.throws(() => validateImageSeriesReviews([review(), review({ sampleId: "sample-002", sceneNumber: 13 })]), /sceneNumber/);
});

test("rejects paths, URLs, invalid reviewer labels and incomplete score rubrics", () => {
  assert.throws(() => validateImageSeriesReviews([review({ sampleId: "../private.png" }), review({ sampleId: "sample-002", sceneNumber: 2 })]), /opaque identifier/);
  assert.throws(() => validateImageSeriesReviews([review({ reviewer: "person@example.com" }), review({ sampleId: "sample-002", sceneNumber: 2 })]), /non-identifying label/);
  assert.throws(() => validateImageSeriesReviews([review({ scores: { subjectContinuity: 5 } }), review({ sampleId: "sample-002", sceneNumber: 2 })]), /wardrobeContinuity/);
});

test("rejects malformed timestamps, unknown dimensions and out-of-range scores", () => {
  assert.throws(() => validateImageSeriesReviews([review({ reviewedAt: "yesterday" }), review({ sampleId: "sample-002", sceneNumber: 2 })]), /ISO timestamp/);
  assert.throws(() => validateImageSeriesReviews([review({ reviewedAt: "2026-02-30T12:00:00Z" }), review({ sampleId: "sample-002", sceneNumber: 2 })]), /valid timezone-qualified ISO timestamp/);
  assert.throws(() => validateImageSeriesReviews([review({ scores: { ...scores, realism: 5 } }), review({ sampleId: "sample-002", sceneNumber: 2 })]), /unsupported dimensions/);
  assert.throws(() => validateImageSeriesReviews([review({ scores: { ...scores, styleContinuity: 6 } }), review({ sampleId: "sample-002", sceneNumber: 2 })]), /integer from 1 to 5/);
});
