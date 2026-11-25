export const STUDENT_GRADE_MIN = 1;
export const STUDENT_GRADE_MAX = 10;

export const STUDENT_LEARNING_PATHS = Object.freeze([
  Object.freeze({ id: "story", title: "Story Mode", goal: "Build an intuitive mental model through an age-appropriate story." }),
  Object.freeze({ id: "visual", title: "Visual Explainer", goal: "Explain with labelled diagrams, concrete comparisons and visual steps." }),
  Object.freeze({ id: "play", title: "Play & Solve", goal: "Practise one question or challenge at a time with helpful feedback." }),
  Object.freeze({ id: "adventure", title: "Adventure Mode", goal: "Explore through short missions, discoveries and knowledge checks." }),
  Object.freeze({ id: "talk", title: "Talk & Learn", goal: "Use a supportive dialogue and check understanding without pressure." }),
  Object.freeze({ id: "experiment", title: "Create & Experiment", goal: "Learn by making, observing or using a safe thought experiment." }),
]);

const PATH_IDS = new Set(STUDENT_LEARNING_PATHS.map((path) => path.id));
const MAX_TOPIC_LENGTH = 160;
const MAX_LANGUAGE_LENGTH = 35;

function cleanText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function validateStudentProfile(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const grade = input.grade;
  const language = cleanText(input.language, MAX_LANGUAGE_LENGTH);
  const curriculum = cleanText(input.curriculum, 80);
  if (!Number.isInteger(grade) || grade < STUDENT_GRADE_MIN || grade > STUDENT_GRADE_MAX) return null;
  if (!language || !curriculum) return null;
  return Object.freeze({ grade, language, curriculum });
}

export function validateStudentLearningRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const profile = validateStudentProfile(input.profile);
  const topic = cleanText(input.topic, MAX_TOPIC_LENGTH);
  const preferredPath = input.preferredPath == null ? null : input.preferredPath;
  if (!profile || !topic || (preferredPath !== null && !PATH_IDS.has(preferredPath))) return null;
  return Object.freeze({ profile, topic, preferredPath });
}

/**
 * Choose one of the six Student Mode paths using only compact concept-level
 * learning signals. No learner free-text or personal data is accepted here.
 */
export function recommendStudentLearningPath(progress, preferredPath = null) {
  if (preferredPath !== null && !PATH_IDS.has(preferredPath)) return null;
  const concepts = Array.isArray(progress?.concepts) ? progress.concepts : [];
  const needsReview = concepts.some((concept) => concept?.status === "needs-review");
  const secure = concepts.length > 0 && concepts.every((concept) => concept?.status === "secure");
  const developing = concepts.some((concept) => concept?.status === "developing");

  let recommendedPath = needsReview ? "visual" : secure ? "adventure" : developing ? "play" : "story";
  if (preferredPath) recommendedPath = preferredPath;
  const selected = STUDENT_LEARNING_PATHS.find((path) => path.id === recommendedPath);
  return Object.freeze({
    recommendedPath: selected.id,
    title: selected.title,
    reason: preferredPath
      ? "learner-choice"
      : needsReview
        ? "try-a-different-explanation"
        : secure
          ? "ready-for-a-transfer-challenge"
          : developing
            ? "guided-practice"
            : "start-with-a-story",
    paths: STUDENT_LEARNING_PATHS,
  });
}

/**
 * Returns a bounded teaching brief for the selected path. This is a prompt
 * policy, not a generated lesson or a factual correctness guarantee.
 */
export function createStudentTeachingBrief(input) {
  const request = validateStudentLearningRequest(input);
  if (!request) return null;
  const recommendation = recommendStudentLearningPath(input.progress, request.preferredPath);
  if (!recommendation) return null;
  const gradeInstruction = request.profile.grade <= 3
    ? "Use very short sentences, familiar everyday examples, gentle encouragement and concrete objects."
    : request.profile.grade <= 6
      ? "Use clear step-by-step explanations, relatable examples, simple vocabulary and frequent understanding checks."
      : "Use age-appropriate detail, explain the reasoning, connect ideas to real situations and invite critical thinking.";
  const path = STUDENT_LEARNING_PATHS.find((item) => item.id === recommendation.recommendedPath);
  return Object.freeze({
    grade: request.profile.grade,
    language: request.profile.language,
    curriculum: request.profile.curriculum,
    topic: request.topic,
    path: path.id,
    pathTitle: path.title,
    pathGoal: path.goal,
    teachingGuidance: gradeInstruction,
    safetyGuidance: "Keep examples age-appropriate. Do not request a child's full name, address, contact details, school identity, passwords or private family information. Experiments must be safe, supervised when appropriate, and must offer a simulation or thought experiment when risk is present.",
    sequence: Object.freeze(["spark-curiosity", "explain-the-idea", "explore-a-visual", "check-understanding", "celebrate-and-reflect"]),
  });
}
