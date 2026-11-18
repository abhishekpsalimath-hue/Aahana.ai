const MAX_OUTCOMES = 100;
const MAX_CONCEPTS = 50;
const MAX_CONCEPT_ID = 80;
const MAX_MISCONCEPTION_ID = 80;

function boundedId(value, maxLength) {
  if (typeof value !== "string") return "";
  const normalized = value.normalize("NFKC").trim().toLowerCase();
  return /^[\p{L}\p{N}][\p{L}\p{N}._:-]*$/u.test(normalized) && normalized.length <= maxLength
    ? normalized
    : "";
}

/**
 * Accepts compact assessment signals only. Do not pass learner free-text,
 * names, contact details, or sensitive personal information into this model.
 */
export function validateLearningOutcomes(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_OUTCOMES) return null;
  const outcomes = [];
  for (const item of input) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const conceptId = boundedId(item.conceptId, MAX_CONCEPT_ID);
    const misconceptionId = item.misconceptionId == null || item.misconceptionId === ""
      ? null
      : boundedId(item.misconceptionId, MAX_MISCONCEPTION_ID);
    if (!conceptId || (item.misconceptionId != null && item.misconceptionId !== "" && !misconceptionId) ||
        typeof item.correct !== "boolean" ||
        (item.hintUsed !== undefined && typeof item.hintUsed !== "boolean") ||
        (item.attempt !== undefined && (!Number.isInteger(item.attempt) || item.attempt < 1 || item.attempt > 10))) return null;
    outcomes.push(Object.freeze({
      conceptId,
      correct: item.correct,
      misconceptionId,
      hintUsed: item.hintUsed === true,
      attempt: item.attempt ?? 1,
    }));
  }
  return Object.freeze(outcomes);
}

export function summarizeLearningProgress(input) {
  const outcomes = validateLearningOutcomes(input);
  if (!outcomes) return null;
  const concepts = new Map();
  for (const outcome of outcomes) {
    if (!concepts.has(outcome.conceptId)) {
      if (concepts.size >= MAX_CONCEPTS) return null;
      concepts.set(outcome.conceptId, {
        conceptId: outcome.conceptId,
        attempts: 0,
        correct: 0,
        hintsUsed: 0,
        misconceptions: new Map(),
      });
    }
    const record = concepts.get(outcome.conceptId);
    record.attempts += 1;
    if (outcome.correct) record.correct += 1;
    if (outcome.hintUsed) record.hintsUsed += 1;
    if (outcome.misconceptionId) {
      record.misconceptions.set(
        outcome.misconceptionId,
        (record.misconceptions.get(outcome.misconceptionId) || 0) + 1,
      );
    }
  }
  const summary = [...concepts.values()].map((record) => {
    const repeatedMisconceptions = [...record.misconceptions.entries()]
      .filter(([, count]) => count >= 2)
      .map(([id, count]) => ({ id, count }));
    const accuracy = record.correct / record.attempts;
    const status = repeatedMisconceptions.length > 0 || (record.attempts >= 3 && accuracy < 0.6)
      ? "needs-review"
      : record.attempts >= 3 && accuracy >= 0.8
        ? "secure"
        : "developing";
    const nextStep = status === "needs-review"
      ? "re-explain-with-a-different-example"
      : status === "secure"
        ? "offer-a-transfer-challenge"
        : "continue-guided-practice";
    return Object.freeze({
      conceptId: record.conceptId,
      attempts: record.attempts,
      correct: record.correct,
      accuracy: Number(accuracy.toFixed(3)),
      hintsUsed: record.hintsUsed,
      repeatedMisconceptions: Object.freeze(repeatedMisconceptions),
      status,
      nextStep,
    });
  });
  return Object.freeze({
    version: "aahana_learner_progress_v1",
    outcomeCount: outcomes.length,
    concepts: Object.freeze(summary),
  });
}
