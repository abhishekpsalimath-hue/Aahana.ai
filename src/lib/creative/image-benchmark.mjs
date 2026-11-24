const DIMENSIONS = Object.freeze([
  "subjectFidelity",
  "attributeFidelity",
  "compositionFidelity",
  "constraintFidelity",
  "visualCoherence",
]);

// A case counts as accepted only when the subject and explicit constraints
// are each at least 4/5 and the five-dimension mean is at least 4/5.
export const IMAGE_CASE_ACCEPTANCE_THRESHOLD = 4;

function isScore(value) {
  return Number.isFinite(value) && value >= 0 && value <= 5;
}

function mean(values) {
  return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null;
}

function validateResult(result, index) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new TypeError(`Result ${index + 1} must be an object.`);
  }
  if (typeof result.caseId !== "string" || !result.caseId.trim()) {
    throw new TypeError(`Result ${index + 1} needs a caseId.`);
  }
  if (typeof result.model !== "string" || !result.model.trim()) {
    throw new TypeError(`Result ${index + 1} needs a model name.`);
  }
  if (typeof result.category !== "string" || !result.category.trim()) {
    throw new TypeError(`Result ${index + 1} needs a category.`);
  }
  for (const dimension of DIMENSIONS) {
    if (!isScore(result[dimension])) {
      throw new RangeError(`Result ${index + 1} has an invalid ${dimension} score (expected 0–5).`);
    }
  }
  if (result.latencySeconds !== undefined &&
      (!Number.isFinite(result.latencySeconds) || result.latencySeconds < 0)) {
    throw new RangeError(`Result ${index + 1} has invalid latencySeconds.`);
  }
  if (result.exactTextPass !== undefined && typeof result.exactTextPass !== "boolean") {
    throw new TypeError(`Result ${index + 1} exactTextPass must be true or false.`);
  }
  return result;
}

/**
 * Summarize manually scored, synthetic image benchmark outputs.
 * This function never calls a provider and never reads user uploads.
 */
export function summarizeImageBenchmark(results) {
  if (!Array.isArray(results) || results.length === 0) {
    throw new TypeError("Provide at least one scored benchmark result.");
  }

  const seen = new Set();
  const byModel = new Map();
  results.forEach((raw, index) => {
    const result = validateResult(raw, index);
    const key = `${result.model.trim()}::${result.caseId.trim()}`;
    if (seen.has(key)) throw new Error(`Duplicate result for model ${result.model} and case ${result.caseId}.`);
    seen.add(key);
    const model = result.model.trim();
    if (!byModel.has(model)) byModel.set(model, []);
    byModel.get(model).push(result);
  });

  return [...byModel.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([model, entries]) => {
    const dimensions = Object.fromEntries(DIMENSIONS.map((dimension) => [
      dimension,
      mean(entries.map((entry) => entry[dimension])),
    ]));
    const dimensionValues = Object.values(dimensions);
    const acceptedCases = entries.filter((entry) =>
      entry.subjectFidelity >= IMAGE_CASE_ACCEPTANCE_THRESHOLD &&
      entry.constraintFidelity >= IMAGE_CASE_ACCEPTANCE_THRESHOLD &&
      mean(DIMENSIONS.map((dimension) => entry[dimension])) >= IMAGE_CASE_ACCEPTANCE_THRESHOLD
    ).length;
    const textChecks = entries.filter((entry) => entry.exactTextPass !== undefined);
    const latencies = entries.filter((entry) => entry.latencySeconds !== undefined).map((entry) => entry.latencySeconds);
    const categories = [...new Set(entries.map((entry) => entry.category.trim()))].sort();
    const categoryScores = Object.fromEntries(categories.map((category) => {
      const categoryEntries = entries.filter((entry) => entry.category.trim() === category);
      return [category, {
        cases: categoryEntries.length,
        averageScore: mean(categoryEntries.flatMap((entry) => DIMENSIONS.map((dimension) => entry[dimension]))),
      }];
    }));
    return {
      model,
      cases: entries.length,
      averageScore: mean(dimensionValues),
      acceptedCases,
      caseAcceptanceRate: Number((acceptedCases / entries.length).toFixed(3)),
      acceptanceThreshold: IMAGE_CASE_ACCEPTANCE_THRESHOLD,
      dimensions,
      exactTextPassRate: textChecks.length
        ? Number((textChecks.filter((entry) => entry.exactTextPass).length / textChecks.length).toFixed(3))
        : null,
      exactTextCases: textChecks.length,
      averageLatencySeconds: mean(latencies),
      latencyCases: latencies.length,
      categoryScores,
    };
  });
}

export const IMAGE_BENCHMARK_DIMENSIONS = DIMENSIONS;
