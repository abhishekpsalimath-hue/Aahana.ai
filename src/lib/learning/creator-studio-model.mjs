export const CREATOR_DRAFT_VERSION = 1;
export const CREATOR_DRAFT_STORAGE_KEY = "aahana:creator-studio:drafts:v1";
export const CREATOR_VISUAL_TYPES = Object.freeze(["diagram", "3d-model", "motion-scene", "knowledge-check"]);

export function createCreatorDraft(now = new Date().toISOString()) {
  return {
    version: CREATOR_DRAFT_VERSION,
    id: `draft-${Date.now()}`,
    title: "Untitled learning experience",
    subject: "",
    learnerLevel: "Flexible",
    objective: "",
    visualStyle: "motion-scene",
    scenes: [{ id: "scene-1", title: "First idea", narration: "", visualType: "motion-scene", visualNotes: "" }],
    status: "draft",
    updatedAt: now,
  };
}

export function validateCreatorDraft(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const title = typeof input.title === "string" ? input.title.trim().slice(0, 120) : "";
  const subject = typeof input.subject === "string" ? input.subject.trim().slice(0, 80) : "";
  const objective = typeof input.objective === "string" ? input.objective.trim().slice(0, 500) : "";
  const learnerLevel = typeof input.learnerLevel === "string" ? input.learnerLevel.trim().slice(0, 60) : "Flexible";
  const visualStyle = CREATOR_VISUAL_TYPES.includes(input.visualStyle) ? input.visualStyle : "motion-scene";
  if (!title || !Array.isArray(input.scenes) || input.scenes.length < 1 || input.scenes.length > 30) return null;
  const scenes = input.scenes.map((scene, index) => ({
    id: typeof scene?.id === "string" ? scene.id.slice(0, 80) : `scene-${index + 1}`,
    title: typeof scene?.title === "string" ? scene.title.trim().slice(0, 120) : "",
    narration: typeof scene?.narration === "string" ? scene.narration.trim().slice(0, 3000) : "",
    visualType: CREATOR_VISUAL_TYPES.includes(scene?.visualType) ? scene.visualType : "diagram",
    visualNotes: typeof scene?.visualNotes === "string" ? scene.visualNotes.trim().slice(0, 1000) : "",
  }));
  if (scenes.some((scene) => !scene.title)) return null;
  return {
    version: CREATOR_DRAFT_VERSION,
    id: typeof input.id === "string" ? input.id.slice(0, 80) : `draft-${Date.now()}`,
    title, subject, objective, learnerLevel, visualStyle, scenes,
    status: "draft",
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : new Date().toISOString(),
  };
}

export function buildCreatorExport(draft) {
  const valid = validateCreatorDraft(draft);
  if (!valid) throw new TypeError("This creator draft is incomplete or invalid.");
  return {
    format: "aahana-learning-studio",
    formatVersion: CREATOR_DRAFT_VERSION,
    exportedAt: new Date().toISOString(),
    draft: valid,
    publishing: { status: "not-published", note: "This export is a creator draft. It has not been published to learners." },
  };
}
