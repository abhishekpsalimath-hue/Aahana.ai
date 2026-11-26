const TRANSITIONS = new Set(["start", "cut", "dissolve", "match-cut", "whip-pan", "fade"]);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const MAX_SHOTS = 6;
const MAX_TOTAL_SECONDS = 15;
const MAX_PROMPT_LENGTH = 2000;

function text(value, label, max = 180) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new TypeError(label + " must be 1–" + max + " characters.");
  }
  return value.trim();
}

function stableId(value, label) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new TypeError(label + " must be a stable opaque identifier.");
  }
  return value;
}

/**
 * Validate a short multi-shot storyboard and compile it into one provider prompt.
 * This is a prompt/storyboard planner, not a guarantee of native multi-shot generation.
 */
export function compileVideoStoryboard(input, concept = "") {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("A storyboard object is required.");
  }
  const title = text(input.title, "Storyboard title", 80);
  const visualStyle = text(input.visualStyle, "Storyboard visual style", 160);
  const continuity = input.continuity;
  if (!continuity || typeof continuity !== "object" || Array.isArray(continuity)) {
    throw new TypeError("A global continuity lock is required.");
  }
  const subjectId = stableId(continuity.subjectId, "Continuity subject id");
  const wardrobeId = continuity.wardrobeId === undefined || continuity.wardrobeId === ""
    ? null : stableId(continuity.wardrobeId, "Continuity wardrobe id");
  const propIds = continuity.propIds === undefined ? [] : continuity.propIds;
  if (!Array.isArray(propIds) || propIds.length > 12 ||
      propIds.some((id) => typeof id !== "string" || !ID_PATTERN.test(id)) ||
      new Set(propIds).size !== propIds.length) {
    throw new TypeError("Continuity propIds must contain up to 12 unique stable identifiers.");
  }
  if (!Array.isArray(input.shots) || input.shots.length < 2 || input.shots.length > MAX_SHOTS) {
    throw new RangeError("A storyboard must contain between 2 and 6 shots.");
  }
  const seen = new Set();
  let durationSeconds = 0;
  const shots = input.shots.map((shot, index) => {
    if (!shot || typeof shot !== "object" || Array.isArray(shot)) {
      throw new TypeError("Storyboard shot " + (index + 1) + " must be an object.");
    }
    const id = stableId(shot.id, "Shot id");
    if (seen.has(id)) throw new Error("Storyboard shot ids must be unique.");
    seen.add(id);
    if (!Number.isInteger(shot.durationSeconds) || shot.durationSeconds < 1 || shot.durationSeconds > 15) {
      throw new RangeError("Each shot duration must be an integer from 1 to 15 seconds.");
    }
    durationSeconds += shot.durationSeconds;
    if (durationSeconds > MAX_TOTAL_SECONDS) {
      throw new RangeError("The storyboard cannot exceed the provider's 15-second generation limit.");
    }
    const transition = shot.transition === undefined ? (index === 0 ? "start" : "cut") : shot.transition;
    if (!TRANSITIONS.has(transition) || (index === 0 && transition !== "start") || (index > 0 && transition === "start")) {
      throw new TypeError("Use start for the first shot and a supported transition for each later shot.");
    }
    return Object.freeze({
      id,
      durationSeconds: shot.durationSeconds,
      scene: text(shot.scene, "Shot " + (index + 1) + " scene"),
      action: text(shot.action, "Shot " + (index + 1) + " action"),
      camera: text(shot.camera, "Shot " + (index + 1) + " camera"),
      transition,
    });
  });
  const safeConcept = typeof concept === "string" ? concept.trim().slice(0, 220) : "";
  const lines = [
    "Create one coherent cinematic multi-shot sequence. Treat the following as an ordered storyboard, not unrelated clips.",
    "STORYBOARD: " + title,
    "VISUAL STYLE: " + visualStyle,
    "GLOBAL CONTINUITY LOCK: Preserve the same subject identity (" + subjectId + ") across every shot." +
      (wardrobeId ? " Preserve wardrobe identity (" + wardrobeId + ")." : "") +
      (propIds.length ? " Keep these props visually consistent: " + propIds.join(", ") + "." : ""),
    "Do not redesign the subject, change facial identity, alter wardrobe or silently add/remove locked props between cuts.",
    ...(safeConcept ? ["CREATIVE CONCEPT: " + safeConcept] : []),
    ...shots.map((shot, index) => {
      const start = shots.slice(0, index).reduce((sum, item) => sum + item.durationSeconds, 0);
      const end = start + shot.durationSeconds;
      return "SHOT " + (index + 1) + " (" + start + "–" + end + "s; " + shot.durationSeconds + "s): " +
        "Scene: " + shot.scene + " Action: " + shot.action + " Camera: " + shot.camera +
        " Transition: " + shot.transition + ".";
    }),
    "Maintain screen direction, lighting logic, color grade, spatial geography and temporal continuity. Use clear intentional edits at the specified boundaries. Do not add extra shots or title cards.",
  ];
  const prompt = lines.join("\n");
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new RangeError("The compiled storyboard exceeds the 2,000-character provider prompt limit. Shorten shot descriptions.");
  }
  return Object.freeze({
    title,
    visualStyle,
    continuity: Object.freeze({ subjectId, wardrobeId, propIds: Object.freeze([...propIds]) }),
    shots: Object.freeze(shots),
    durationSeconds,
    prompt,
    scope: "validated storyboard and prompt plan; provider output may not follow every shot boundary exactly",
  });
}

export const VIDEO_STORYBOARD_LIMITS = Object.freeze({
  minShots: 2,
  maxShots: MAX_SHOTS,
  maxDurationSeconds: MAX_TOTAL_SECONDS,
  maxPromptCharacters: MAX_PROMPT_LENGTH,
});
