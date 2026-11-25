import test from "node:test";
import assert from "node:assert/strict";
import { validateVideoSampleReviews, summarizeVideoSampleReviews, VIDEO_SAMPLE_REVIEW_DIMENSIONS } from "./video-sample-review.mjs";

const scores = { identityContinuity: 5, motionContinuity: 4, cameraContinuity: 4, transitionCoherence: 5, temporalProgression: 4 };
function review(overrides = {}) {
  return { seriesId: "video-series-01", sampleId: "clip-sample-01", model: "offline-fixture", reviewer: "reviewer-a", shotNumber: 1, reviewedAt: "2026-11-25T12:00:00Z", scores, notes: "Synthetic metadata only.", ...overrides };
}

test("validates shot reviews against the fixed five-dimension rubric", () => {
  assert.equal(validateVideoSampleReviews([review(), review({ sampleId: "clip-sample-02", shotNumber: 2 })]).length, 2);
  assert.deepEqual(VIDEO_SAMPLE_REVIEW_DIMENSIONS, ["identityContinuity", "motionContinuity", "cameraContinuity", "transitionCoherence", "temporalProgression"]);
});

test("aggregates sequence coverage, shot scores and reviewer disagreement", () => {
  const summary = summarizeVideoSampleReviews([
    review(),
    review({ sampleId: "clip-sample-02", shotNumber: 2, reviewer: "reviewer-b", scores: { ...scores, identityContinuity: 3 } }),
    review({ sampleId: "clip-sample-03", shotNumber: 2, reviewer: "reviewer-a" }),
  ])[0];
  assert.equal(summary.reviewedShots, 2);
  assert.deepEqual(summary.shotNumbers, [1, 2]);
  assert.deepEqual(summary.missingShotNumbers, []);
  assert.equal(summary.reviewCount, 3);
  assert.equal(summary.reviewerCount, 2);
  assert.equal(summary.perShot[1].reviews, 2);
  assert.equal(summary.dimensions.identityContinuity, 4.33);
  assert.equal(summary.reviewerSpread.identityContinuity, 2);
});

test("reports missing shots rather than silently treating sequence as complete", () => {
  const summary = summarizeVideoSampleReviews([review(), review({ sampleId: "clip-sample-03", shotNumber: 3 })])[0];
  assert.deepEqual(summary.missingShotNumbers, [2]);
});

test("rejects one-shot sequences, duplicate reviewer-shot entries and invalid shot numbers", () => {
  assert.throws(() => validateVideoSampleReviews([review()]), /at least two/);
  assert.throws(() => validateVideoSampleReviews([review(), review({ reviewer: "reviewer-b" })]), /at least two distinct shots/);
  assert.throws(() => validateVideoSampleReviews([review(), review()]), /Duplicate reviewer submission/);
  assert.throws(() => validateVideoSampleReviews([review(), review({ sampleId: "clip-sample-13", shotNumber: 13 })]), /shotNumber/);
});

test("rejects paths, URLs, identifying reviewer labels and incomplete score rubrics", () => {
  assert.throws(() => validateVideoSampleReviews([review({ sampleId: "../private.mp4" }), review({ sampleId: "clip-sample-02", shotNumber: 2 })]), /opaque identifier/);
  assert.throws(() => validateVideoSampleReviews([review({ reviewer: "person@example.com" }), review({ sampleId: "clip-sample-02", shotNumber: 2 })]), /non-identifying label/);
  assert.throws(() => validateVideoSampleReviews([review({ scores: { identityContinuity: 5 } }), review({ sampleId: "clip-sample-02", shotNumber: 2 })]), /motionContinuity/);
});

test("rejects malformed timestamps, unsupported dimensions and out-of-range scores", () => {
  assert.throws(() => validateVideoSampleReviews([review({ reviewedAt: "yesterday" }), review({ sampleId: "clip-sample-02", shotNumber: 2 })]), /ISO timestamp/);
  assert.throws(() => validateVideoSampleReviews([review({ scores: { ...scores, realism: 5 } }), review({ sampleId: "clip-sample-02", shotNumber: 2 })]), /unsupported dimensions/);
  assert.throws(() => validateVideoSampleReviews([review({ scores: { ...scores, cameraContinuity: 6 } }), review({ sampleId: "clip-sample-02", shotNumber: 2 })]), /integer from 1 to 5/);
});
