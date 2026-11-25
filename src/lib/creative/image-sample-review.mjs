import { IMAGE_BENCHMARK_CASES } from "./image-benchmark-cases.mjs";

const CASE_BY_ID = new Map(IMAGE_BENCHMARK_CASES.map((item) => [item.id, item]));
const DIMENSIONS = Object.freeze([
  "subjectFidelity",
  "attributeFidelity",
  "compositionFidelity",
  "constraintFidelity",
  "visualCoherence",
]);

function requireText(value, field, maxLength = 120) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw new TypeError(`Review needs a non-empty ${field} (max ${maxLength} characters).`);
  }
  return value.trim();
}

function validateTimestamp(value) {
  const match = typeof value === "string" &&
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) {
    throw new TypeError("Review reviewedAt must be a valid timezone-qualified ISO timestamp.");
  }
  const [, year, month, day, hour, minute, second, , offsetHour, offsetMinute] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 ||
      date.getUTCDate() !== Number(day) || Number(hour) > 23 || Number(minute) > 59 ||
      Number(second) > 59 || (offsetHour !== undefined && (Number(offsetHour) > 23 || Number(offsetMinute) > 59))) {
    throw new TypeError("Review reviewedAt must be a valid timezone-qualified ISO timestamp.");
  }
  return value;
}

/**
 * Validate human reviews of generated image samples.
 * sampleId is an opaque local artifact identifier, never a path or URL.
 * This module is deliberately offline: it performs no file or network I/O.
 */
export function validateImageSampleReviews(reviews) {
  if (!Array.isArray(reviews) || reviews.length === 0) {
    throw new TypeError("Provide at least one image sample review.");
  }

  const seenSamples = new Set();
  return reviews.map((raw, index) => {
    const label = `Review ${index + 1}`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new TypeError(`${label} must be an object.`);
    }

    const sampleId = requireText(raw.sampleId, "sampleId", 80);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/.test(sampleId)) {
      throw new TypeError(`${label} sampleId must be an opaque identifier, not a path or URL.`);
    }
    if (seenSamples.has(sampleId)) throw new Error(`Duplicate image sampleId: ${sampleId}.`);
    seenSamples.add(sampleId);

    const caseId = requireText(raw.caseId, "caseId", 20);
    const benchmarkCase = CASE_BY_ID.get(caseId);
    if (!benchmarkCase) throw new RangeError(`${label} references an unknown benchmark case: ${caseId}.`);
    const category = requireText(raw.category, "category", 40);
    if (category !== benchmarkCase.category) {
      throw new RangeError(`${label} category does not match benchmark case ${caseId}.`);
    }

    const model = requireText(raw.model, "model", 100);
    const reviewer = requireText(raw.reviewer, "reviewer", 40);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/.test(reviewer)) {
      throw new TypeError(`${label} reviewer must be a non-identifying reviewer label, not a name or email address.`);
    }
    const reviewedAt = validateTimestamp(raw.reviewedAt);
    if (!raw.scores || typeof raw.scores !== "object" || Array.isArray(raw.scores)) {
      throw new TypeError(`${label} needs a complete five-dimension scores object.`);
    }
    const unexpectedDimensions = Object.keys(raw.scores).filter((key) => !DIMENSIONS.includes(key));
    if (unexpectedDimensions.length) {
      throw new TypeError(`${label} contains unsupported scoring dimensions: ${unexpectedDimensions.join(", ")}.`);
    }
    const scores = {};
    for (const dimension of DIMENSIONS) {
      const score = raw.scores[dimension];
      if (!Number.isInteger(score) || score < 1 || score > 5) {
        throw new RangeError(`${label} has an invalid ${dimension} score (expected integer 1–5).`);
      }
      scores[dimension] = score;
    }
    const notes = raw.notes === undefined ? "" : raw.notes;
    if (typeof notes !== "string" || notes.length > 1000) {
      throw new TypeError(`${label} notes must be text no longer than 1000 characters.`);
    }

    return Object.freeze({
      sampleId,
      caseId,
      category,
      model,
      reviewer,
      reviewedAt,
      scores: Object.freeze(scores),
      notes: notes.trim(),
    });
  });
}

function mean(values) {
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

/**
 * Summarize complete human-scored output reviews.
 * This is output-quality evidence, separate from prompt-readiness benchmarks.
 */
export function summarizeImageSampleReviews(reviews) {
  const validated = validateImageSampleReviews(reviews);
  const byModel = new Map();
  for (const review of validated) {
    if (!byModel.has(review.model)) byModel.set(review.model, []);
    byModel.get(review.model).push(review);
  }

  return [...byModel.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([model, entries]) => ({
    model,
    reviewedSamples: entries.length,
    distinctCases: new Set(entries.map((entry) => entry.caseId)).size,
    dimensions: Object.fromEntries(DIMENSIONS.map((dimension) => [
      dimension,
      mean(entries.map((entry) => entry.scores[dimension])),
    ])),
    averageOutputQuality: mean(entries.flatMap((entry) => DIMENSIONS.map((dimension) => entry.scores[dimension]))),
    reviewers: [...new Set(entries.map((entry) => entry.reviewer))].sort(),
  }));
}

export const IMAGE_SAMPLE_REVIEW_DIMENSIONS = DIMENSIONS;
