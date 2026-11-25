const DIMENSIONS = Object.freeze([
  "identityContinuity",
  "motionContinuity",
  "cameraContinuity",
  "transitionCoherence",
  "temporalProgression",
]);

function label(value, field, max = 100) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new TypeError(`Video review needs a non-empty ${field} (max ${max} characters).`);
  }
  return value.trim();
}

function timestamp(value) {
  const match = typeof value === "string" &&
    /^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2}):(\\d{2})(?:\\.\\d{1,3})?(Z|[+-](\\d{2}):(\\d{2}))$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) {
    throw new TypeError("Video review reviewedAt must be a valid timezone-qualified ISO timestamp.");
  }
  const [, year, month, day, hour, minute, second, , offsetHour, offsetMinute] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 ||
      date.getUTCDate() !== Number(day) || Number(hour) > 23 || Number(minute) > 59 ||
      Number(second) > 59 || (offsetHour !== undefined && (Number(offsetHour) > 23 || Number(offsetMinute) > 59))) {
    throw new TypeError("Video review reviewedAt must be a valid timezone-qualified ISO timestamp.");
  }
  return value;
}

/** Validate offline human assessments; this module never reads or uploads video media. */
export function validateVideoSampleReviews(reviews) {
  if (!Array.isArray(reviews) || reviews.length < 2) {
    throw new TypeError("Provide at least two shot reviews for a video sequence.");
  }
  const seen = new Set();
  const sampleByShot = new Map();
  const shotBySample = new Map();
  const validated = reviews.map((raw, index) => {
    const prefix = `Video review ${index + 1}`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new TypeError(`${prefix} must be an object.`);
    const seriesId = label(raw.seriesId, "seriesId", 80);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/.test(seriesId)) throw new TypeError(`${prefix} seriesId must be an opaque identifier.`);
    const sampleId = label(raw.sampleId, "sampleId", 80);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/.test(sampleId)) throw new TypeError(`${prefix} sampleId must be an opaque identifier, not a path or URL.`);
    const model = label(raw.model, "model", 100);
    const reviewer = label(raw.reviewer, "reviewer", 40);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/.test(reviewer)) throw new TypeError(`${prefix} reviewer must be a non-identifying label.`);
    if (!Number.isInteger(raw.shotNumber) || raw.shotNumber < 1 || raw.shotNumber > 12) throw new RangeError(`${prefix} shotNumber must be an integer from 1 to 12.`);
    const sequenceKey = `${model}::${seriesId}`;
    const shotKey = `${sequenceKey}::shot-${raw.shotNumber}`;
    const sampleKey = `${sequenceKey}::sample-${sampleId}`;
    if (sampleByShot.has(shotKey) && sampleByShot.get(shotKey) !== sampleId) {
      throw new Error(`Video shot ${shotKey} cannot reference multiple sample IDs.`);
    }
    if (shotBySample.has(sampleKey) && shotBySample.get(sampleKey) !== raw.shotNumber) {
      throw new Error(`Video sample ${sampleId} cannot be reused across different shots.`);
    }
    sampleByShot.set(shotKey, sampleId);
    shotBySample.set(sampleKey, raw.shotNumber);
    const key = [seriesId, model, raw.shotNumber, reviewer].join("::");
    if (seen.has(key)) throw new Error(`Duplicate reviewer submission for video shot: ${key}.`);
    seen.add(key);
    if (!raw.scores || typeof raw.scores !== "object" || Array.isArray(raw.scores)) throw new TypeError(`${prefix} needs all five video scores.`);
    const unexpected = Object.keys(raw.scores).filter((dimension) => !DIMENSIONS.includes(dimension));
    if (unexpected.length) throw new TypeError(`${prefix} has unsupported dimensions: ${unexpected.join(", ")}.`);
    const scores = {};
    for (const dimension of DIMENSIONS) {
      const value = raw.scores[dimension];
      if (!Number.isInteger(value) || value < 1 || value > 5) throw new RangeError(`${prefix} ${dimension} must be an integer from 1 to 5.`);
      scores[dimension] = value;
    }
    const notes = raw.notes === undefined ? "" : raw.notes;
    if (typeof notes !== "string" || notes.length > 1000) throw new TypeError(`${prefix} notes must be text no longer than 1000 characters.`);
    return Object.freeze({ seriesId, sampleId, model, reviewer, shotNumber: raw.shotNumber, reviewedAt: timestamp(raw.reviewedAt), scores: Object.freeze(scores), notes: notes.trim() });
  });
  const groups = new Map();
  for (const entry of validated) {
    const key = `${entry.model}::${entry.seriesId}`;
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key).add(entry.shotNumber);
  }
  for (const [key, shots] of groups) {
    if (shots.size < 2) throw new TypeError(`Video sequence ${key} must include at least two distinct shots.`);
  }
  return validated;
}

function mean(values) {
  return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null;
}

/** Summarize reviewer judgments, shot coverage and within-shot reviewer disagreement. */
export function summarizeVideoSampleReviews(reviews) {
  const validated = validateVideoSampleReviews(reviews);
  const groups = new Map();
  for (const review of validated) {
    const key = `${review.model}::${review.seriesId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(review);
  }
  return [...groups.values()].map((entries) => {
    const shotNumbers = [...new Set(entries.map((entry) => entry.shotNumber))].sort((a, b) => a - b);
    const reviewers = [...new Set(entries.map((entry) => entry.reviewer))].sort();
    const dimensions = Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, mean(entries.map((entry) => entry.scores[dimension]))]));
    const perShot = shotNumbers.map((shotNumber) => {
      const shot = entries.filter((entry) => entry.shotNumber === shotNumber);
      return { shotNumber, sampleId: shot[0].sampleId, reviews: shot.length, averageScore: mean(shot.flatMap((entry) => DIMENSIONS.map((dimension) => entry.scores[dimension]))) };
    });
    const pairedShots = shotNumbers.map((shotNumber) => entries.filter((entry) => entry.shotNumber === shotNumber)).filter((shot) => shot.length > 1);
    const reviewerSpread = Object.fromEntries(DIMENSIONS.map((dimension) => {
      const spreads = pairedShots.map((shot) => {
        const values = shot.map((entry) => entry.scores[dimension]);
        return Math.max(...values) - Math.min(...values);
      });
      return [dimension, mean(spreads)];
    }));
    const availableSpreads = Object.values(reviewerSpread).filter((value) => value !== null);
    return {
      seriesId: entries[0].seriesId, model: entries[0].model,
      reviewedShots: shotNumbers.length, shotNumbers,
      missingShotNumbers: Array.from({ length: Math.max(...shotNumbers) }, (_, index) => index + 1).filter((number) => !shotNumbers.includes(number)),
      reviewCount: entries.length, reviewerCount: reviewers.length, reviewers,
      dimensions, averageQuality: mean(Object.values(dimensions)), reviewerSpread,
      averageReviewerSpread: availableSpreads.length ? mean(availableSpreads) : null,
      multiReviewedShots: pairedShots.length, perShot,
    };
  }).sort((a, b) => a.model.localeCompare(b.model) || a.seriesId.localeCompare(b.seriesId));
}

export const VIDEO_SAMPLE_REVIEW_DIMENSIONS = DIMENSIONS;
