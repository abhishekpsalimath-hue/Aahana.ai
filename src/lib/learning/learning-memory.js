export const LEARNING_MEMORY_PREFIX = "learning_journey:";

const MAX_TITLE = 100;
const MAX_SUBJECT = 80;
const MAX_LABEL = 80;

export function normalizeLearningSubject(input) {
  if (typeof input !== "string") return "";
  return input.normalize("NFKC").trim().replace(/\\s+/g, " ").slice(0, MAX_SUBJECT);
}

export function validateLearningJourney(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const title = typeof input.title === "string" ? input.title.trim().slice(0, MAX_TITLE) : "";
  const subject = normalizeLearningSubject(input.subject);
  const gradeBand = typeof input.gradeBand === "string" ? input.gradeBand.trim().slice(0, MAX_LABEL) : "";
  const curriculum = typeof input.curriculum === "string" ? input.curriculum.trim().slice(0, MAX_LABEL) : "";
  const language = typeof input.language === "string" ? input.language.trim().slice(0, 35) : "";
  const sceneCount = input.sceneCount;
  const attempts = input.attempts;
  const adaptedScenes = input.adaptedScenes;
  const exploredScenes = input.exploredScenes;
  const scenes = Array.isArray(input.scenes) ? input.scenes.map((scene) => ({
    caption: typeof scene?.caption === "string" ? scene.caption.trim().slice(0, 120) : "",
    alternateExplanationUsed: scene?.alternateExplanationUsed === true,
  })) : [];
  if (!title || !subject || !gradeBand || !curriculum || !language) return null;
  if (!Number.isInteger(sceneCount) || sceneCount < 2 || sceneCount > 6) return null;
  if (!Number.isInteger(attempts) || attempts < sceneCount || attempts > 500) return null;
  if (!Number.isInteger(adaptedScenes) || adaptedScenes < 0 || adaptedScenes > sceneCount) return null;
  if (!Number.isInteger(exploredScenes) || exploredScenes !== sceneCount) return null;
  if (scenes.length !== sceneCount || scenes.some((scene) => !scene.caption)) return null;
  return {
    title, subject, gradeBand, curriculum, language, sceneCount,
    attempts, adaptedScenes, exploredScenes, scenes,
    completedAt: new Date().toISOString(),
  };
}

export function parseLearningJourney(content) {
  if (typeof content !== "string" || !content.startsWith(LEARNING_MEMORY_PREFIX)) return null;
  try {
    const value = JSON.parse(content.slice(LEARNING_MEMORY_PREFIX.length));
    if (!value || typeof value !== "object" || typeof value.title !== "string" ||
        typeof value.subject !== "string" || !value.subject.trim() || value.subject.length > MAX_SUBJECT ||
        !Number.isInteger(value.sceneCount) ||
        !Number.isInteger(value.attempts) || !Number.isInteger(value.adaptedScenes) ||
        !Number.isInteger(value.exploredScenes) || !Array.isArray(value.scenes) || value.scenes.length !== value.sceneCount ||
        value.scenes.some((scene) => typeof scene?.caption !== "string" || typeof scene?.alternateExplanationUsed !== "boolean") ||
        typeof value.completedAt !== "string") return null;
    return value;
  } catch {
    return null;
  }
}

export function serializeLearningJourney(journey) {
  return LEARNING_MEMORY_PREFIX + JSON.stringify(journey);
}
