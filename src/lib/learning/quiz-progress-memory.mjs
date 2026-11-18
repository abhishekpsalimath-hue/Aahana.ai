import { normalizeLearningSubject } from "./learning-memory.js";
import { validateLearningOutcomes } from "./learner-progress-policy.mjs";

export const LEARNING_QUIZ_PREFIX = "learning_quiz:";

export function validateLearningQuizProgress(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const title = typeof input.title === "string" ? input.title.normalize("NFKC").trim().slice(0, 100) : "";
  const subject = normalizeLearningSubject(input.subject);
  const gradeBand = typeof input.gradeBand === "string" ? input.gradeBand.trim().slice(0, 80) : "";
  const curriculum = typeof input.curriculum === "string" ? input.curriculum.trim().slice(0, 80) : "";
  const language = typeof input.language === "string" ? input.language.trim().slice(0, 35) : "";
  const outcomes = validateLearningOutcomes(input.outcomes);
  if (!title || !subject || !gradeBand || !curriculum || !language || !outcomes) return null;
  const summary = {
    questions: new Set(outcomes.map((item) => item.conceptId)).size,
    correct: new Set(outcomes.filter((item) => item.correct).map((item) => item.conceptId)).size,
    attempts: outcomes.length,
    hintsUsed: outcomes.filter((item) => item.hintUsed).length,
  };
  if (summary.questions < 1 || summary.questions > 10) return null;
  return {
    title, subject, gradeBand, curriculum, language,
    ...summary,
    outcomes,
    completedAt: new Date().toISOString(),
  };
}

export function parseLearningQuizProgress(content) {
  if (typeof content !== "string" || !content.startsWith(LEARNING_QUIZ_PREFIX)) return null;
  try {
    const value = JSON.parse(content.slice(LEARNING_QUIZ_PREFIX.length));
    const validated = validateLearningQuizProgress(value);
    return validated && typeof value.completedAt === "string"
      ? { ...validated, completedAt: value.completedAt }
      : null;
  } catch {
    return null;
  }
}

export function serializeLearningQuizProgress(progress) {
  return LEARNING_QUIZ_PREFIX + JSON.stringify(progress);
}
