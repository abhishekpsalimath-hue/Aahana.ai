import test from "node:test";
import assert from "node:assert/strict";
import {
  validateImageSampleReviews,
  summarizeImageSampleReviews,
  IMAGE_SAMPLE_REVIEW_DIMENSIONS,
} from "./image-sample-review.mjs";

function review(overrides = {}) {
  return {
    sampleId: "fixture-img-001",
    caseId: "IMG-001",
    category: "people",
    model: "offline-fixture-model",
    reviewer: "reviewer-a",
    reviewedAt: "2026-11-25T12:00:00Z",
    scores: {
      subjectFidelity: 5,
      attributeFidelity: 4,
      compositionFidelity: 4,
      constraintFidelity: 5,
      visualCoherence: 4,
    },
    notes: "Synthetic fixture metadata; no image bytes or personal data.",
    ...overrides,
  };
}

test("validates an opaque local sample review and fixed five-dimension rubric", () => {
  const [validated] = validateImageSampleReviews([review()]);
  assert.equal(validated.sampleId, "fixture-img-001");
  assert.deepEqual(IMAGE_SAMPLE_REVIEW_DIMENSIONS, [
    "subjectFidelity", "attributeFidelity", "compositionFidelity",
    "constraintFidelity", "visualCoherence",
  ]);
});

test("summarizes human-scored output quality separately by model", () => {
  const summary = summarizeImageSampleReviews([
    review(),
    review({
      sampleId: "fixture-img-002",
      caseId: "IMG-011",
      category: "products",
      scores: {
        subjectFidelity: 3, attributeFidelity: 3, compositionFidelity: 4,
        constraintFidelity: 3, visualCoherence: 4,
      },
    }),
    review({ sampleId: "fixture-img-003", model: "another-model" }),
  ]);
  assert.equal(summary.length, 2);
  const first = summary.find((entry) => entry.model === "offline-fixture-model");
  assert.equal(first.reviewCount, 2);
  assert.equal(first.distinctSamples, 2);
  assert.equal(first.multiReviewedSamples, 0);
  assert.equal(first.distinctCases, 2);
  assert.equal(first.averageOutputQuality, 3.9);
  assert.equal(first.averageReviewerSpread, null);
});

test("rejects empty input and duplicate reviewer submissions while allowing independent reviews of one sample", () => {
  assert.throws(() => validateImageSampleReviews([]), /at least one/);
  assert.throws(() => validateImageSampleReviews([review({ sampleId: "" })]), /sampleId/);
  assert.throws(() => validateImageSampleReviews([review(), review()]), /Duplicate review from reviewer-a/);
  const independent = validateImageSampleReviews([
    review(),
    review({ reviewer: "reviewer-b", scores: { ...review().scores, visualCoherence: 3 } }),
  ]);
  assert.equal(independent.length, 2);
});

test("measures reviewer spread when multiple reviewers score the same sample", () => {
  const summary = summarizeImageSampleReviews([
    review(),
    review({
      reviewer: "reviewer-b",
      scores: {
        subjectFidelity: 4, attributeFidelity: 4, compositionFidelity: 3,
        constraintFidelity: 5, visualCoherence: 2,
      },
    }),
  ])[0];
  assert.equal(summary.reviewCount, 2);
  assert.equal(summary.distinctSamples, 1);
  assert.equal(summary.multiReviewedSamples, 1);
  assert.equal(summary.reviewerCount, 2);
  assert.equal(summary.reviewerSpread.subjectFidelity, 1);
  assert.equal(summary.reviewerSpread.visualCoherence, 2);
  assert.equal(summary.averageReviewerSpread, 0.8);
});

test("rejects paths and remote URLs as sample identifiers", () => {
  assert.throws(() => validateImageSampleReviews([review({ sampleId: "https://example.com/image.png" })]), /opaque identifier/);
  assert.throws(() => validateImageSampleReviews([review({ sampleId: "../private/photo.png" })]), /opaque identifier/);
});

test("rejects unknown cases and category mismatches", () => {
  assert.throws(() => validateImageSampleReviews([review({ caseId: "IMG-999" })]), /unknown benchmark case/);
  assert.throws(() => validateImageSampleReviews([review({ category: "products" })]), /category does not match/);
});

test("rejects incomplete rubrics and scores outside integer 1–5", () => {
  assert.throws(() => validateImageSampleReviews([review({ scores: { subjectFidelity: 5 } })]), /attributeFidelity/);
  assert.throws(() => validateImageSampleReviews([review({ scores: { ...review().scores, visualCoherence: 0 } })]), /visualCoherence/);
  assert.throws(() => validateImageSampleReviews([review({ scores: { ...review().scores, subjectFidelity: 4.5 } })]), /subjectFidelity/);
});

test("rejects identifying reviewer labels and unknown rubric dimensions", () => {
  assert.throws(() => validateImageSampleReviews([review({ reviewer: "person@example.com" })]), /non-identifying reviewer label/);
  assert.throws(() => validateImageSampleReviews([review({ reviewer: "Abhishek Salimath" })]), /non-identifying reviewer label/);
  assert.throws(() => validateImageSampleReviews([review({ scores: { ...review().scores, realism: 5 } })]), /unsupported scoring dimensions/);
});

test("rejects malformed timestamps and oversized notes", () => {
  assert.throws(() => validateImageSampleReviews([review({ reviewedAt: "yesterday" })]), /ISO timestamp/);
  assert.throws(() => validateImageSampleReviews([review({ reviewedAt: "2026-02-30T12:00:00Z" })]), /ISO timestamp/);
  assert.throws(() => validateImageSampleReviews([review({ notes: "x".repeat(1001) })]), /notes/);
});

test("does not mutate source review objects", () => {
  const row = review();
  const before = structuredClone(row);
  validateImageSampleReviews([row]);
  assert.deepEqual(row, before);
});
