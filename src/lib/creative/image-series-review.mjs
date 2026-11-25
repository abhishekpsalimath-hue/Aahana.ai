const DIMENSIONS = Object.freeze([
  "subjectContinuity",
  "wardrobeContinuity",
  "paletteContinuity",
  "styleContinuity",
  "sceneCoherence",
]);

function text(value, field, max = 100) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new TypeError(`Series review needs a non-empty ${field} (max ${max} characters).`);
  }
  return value.trim();
}

function timestamp(value) {
  if (typeof value !== "string" || !/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?(?:Z|[+-]\\d{2}:\\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new TypeError("Series review reviewedAt must be a timezone-qualified ISO timestamp.");
  }
  return value;
}

/**
 * Validate offline human reviews for a connected image series.
 * No image bytes, local paths, URLs, provider calls, or user uploads are read.
 */
export function validateImageSeriesReviews(reviews) {
  if (!Array.isArray(reviews) || reviews.length < 2) {
    throw new TypeError("Provide at least two scene reviews for an image series.");
  }
  const seen = new Set();
  return reviews.map((raw, index) => {
    const label = `Series review ${index + 1}`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new TypeError(`${label} must be an object.`);
    const seriesId = text(raw.seriesId, "seriesId", 80);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/.test(seriesId)) throw new TypeError(`${label} seriesId must be an opaque identifier.`);
    const sampleId = text(raw.sampleId, "sampleId", 80);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/.test(sampleId)) throw new TypeError(`${label} sampleId must be an opaque identifier, not a path or URL.`);
    const model = text(raw.model, "model", 100);
    const reviewer = text(raw.reviewer, "reviewer", 40);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/.test(reviewer)) throw new TypeError(`${label} reviewer must be a non-identifying label.`);
    if (!Number.isInteger(raw.sceneNumber) || raw.sceneNumber < 1 || raw.sceneNumber > 12) throw new RangeError(`${label} sceneNumber must be an integer from 1 to 12.`);
    const key = [seriesId, model, raw.sceneNumber, reviewer].join("::");
    if (seen.has(key)) throw new Error(`Duplicate reviewer submission for series scene: ${key}.`);
    seen.add(key);
    if (!raw.scores || typeof raw.scores !== "object" || Array.isArray(raw.scores)) throw new TypeError(`${label} needs all five continuity scores.`);
    const unexpected = Object.keys(raw.scores).filter((dimension) => !DIMENSIONS.includes(dimension));
    if (unexpected.length) throw new TypeError(`${label} has unsupported dimensions: ${unexpected.join(", ")}.`);
    const scores = {};
    for (const dimension of DIMENSIONS) {
      const value = raw.scores[dimension];
      if (!Number.isInteger(value) || value < 1 || value > 5) throw new RangeError(`${label} ${dimension} must be an integer from 1 to 5.`);
      scores[dimension] = value;
    }
    const notes = raw.notes === undefined ? "" : raw.notes;
    if (typeof notes !== "string" || notes.length > 1000) throw new TypeError(`${label} notes must be text no longer than 1000 characters.`);
    return Object.freeze({
      seriesId, sampleId, model, reviewer, sceneNumber: raw.sceneNumber,
      reviewedAt: timestamp(raw.reviewedAt), scores: Object.freeze(scores), notes: notes.trim(),
    });
  });
}

function mean(values) {
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

/** Summarize continuity scores and scene coverage without implying visual AI evaluation. */
export function summarizeImageSeriesReviews(reviews) {
  const validated = validateImageSeriesReviews(reviews);
  const groups = new Map();
  for (const review of validated) {
    const key = `${review.model}::${review.seriesId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(review);
  }
  return [...groups.values()].map((entries) => {
    const sceneNumbers = [...new Set(entries.map((entry) => entry.sceneNumber))].sort((a, b) => a - b);
    const reviewers = [...new Set(entries.map((entry) => entry.reviewer))].sort();
    const dimensions = Object.fromEntries(DIMENSIONS.map((dimension) => [
      dimension, mean(entries.map((entry) => entry.scores[dimension])),
    ]));
    const perScene = sceneNumbers.map((sceneNumber) => {
      const scene = entries.filter((entry) => entry.sceneNumber === sceneNumber);
      return {
        sceneNumber,
        reviews: scene.length,
        averageScore: mean(scene.flatMap((entry) => DIMENSIONS.map((dimension) => entry.scores[dimension]))),
      };
    });
    const first = entries[0];
    return {
      seriesId: first.seriesId,
      model: first.model,
      reviewedScenes: sceneNumbers.length,
      sceneNumbers,
      missingSceneNumbers: Array.from({ length: Math.max(...sceneNumbers) }, (_, index) => index + 1).filter((number) => !sceneNumbers.includes(number)),
      reviewCount: entries.length,
      reviewerCount: reviewers.length,
      reviewers,
      dimensions,
      averageContinuity: mean(Object.values(dimensions)),
      perScene,
    };
  }).sort((a, b) => a.model.localeCompare(b.model) || a.seriesId.localeCompare(b.seriesId));
}

export const IMAGE_SERIES_REVIEW_DIMENSIONS = DIMENSIONS;
