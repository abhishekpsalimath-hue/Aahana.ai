const DIMENSIONS = Object.freeze({
  identity: { label: "Identity fidelity", weight: 25, critical: true },
  anatomy: { label: "Anatomy and proportions", weight: 15, critical: true },
  requestedChange: { label: "Requested edit accuracy", weight: 20, critical: true },
  preservation: { label: "Unrequested detail preservation", weight: 20, critical: true },
  composition: { label: "Composition and framing", weight: 10, critical: false },
  text: { label: "Text and graphic fidelity", weight: 10, critical: false },
});

const MIN_SCORE = 1;
const MAX_SCORE = 5;
const PASS_THRESHOLD = 4;

function roundScore(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Score one human-reviewed reference-image edit.
 * Use integer scores 1–5; use null only when a dimension genuinely does not apply.
 * A result is incomplete until all critical dimensions have been assessed.
 */
export function scoreReferenceImageEdit(scores) {
  if (!scores || typeof scores !== "object" || Array.isArray(scores)) return null;
  if (Object.keys(scores).some((key) => !Object.hasOwn(DIMENSIONS, key))) return null;

  const normalized = {};
  for (const key of Object.keys(DIMENSIONS)) {
    if (!Object.hasOwn(scores, key)) return null;
    const score = scores[key];
    if (score === undefined) return null;
    if (score !== null && (!Number.isInteger(score) || score < MIN_SCORE || score > MAX_SCORE)) return null;
    normalized[key] = score;
  }

  const missingCritical = Object.entries(DIMENSIONS)
    .filter(([key, dimension]) => dimension.critical && normalized[key] === null)
    .map(([key]) => key);

  const applicable = Object.entries(DIMENSIONS).filter(([key]) => normalized[key] !== null);
  const totalWeight = applicable.reduce((sum, [, dimension]) => sum + dimension.weight, 0);
  const weightedScore = totalWeight === 0
    ? null
    : roundScore(applicable.reduce((sum, [key, dimension]) => sum + normalized[key] * dimension.weight, 0) / totalWeight);

  if (missingCritical.length > 0) {
    return {
      complete: false,
      verdict: "incomplete",
      weightedScore,
      missingCritical,
      failedCritical: [],
      scores: normalized,
    };
  }

  const failedCritical = Object.entries(DIMENSIONS)
    .filter(([key, dimension]) => dimension.critical && normalized[key] < PASS_THRESHOLD)
    .map(([key]) => key);

  return {
    complete: true,
    verdict: failedCritical.length === 0 && weightedScore >= PASS_THRESHOLD ? "pass" : "revise",
    weightedScore,
    missingCritical: [],
    failedCritical,
    scores: normalized,
  };
}

export function getReferenceImageEvaluationDimensions() {
  return Object.entries(DIMENSIONS).map(([key, dimension]) => ({
    key,
    label: dimension.label,
    weight: dimension.weight,
    critical: dimension.critical,
  }));
}
