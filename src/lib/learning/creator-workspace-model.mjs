import { createStudioProject, validateStudioProject } from "@/lib/studio/project-engine.mjs";
import { validateCreatorDraft } from "@/lib/learning/creator-studio-model.mjs";

export const CREATOR_WORKSPACE_SCHEMA = "aahana-creator-workspace/v1";

export function createCreatorWorkspaceDocument(draftInput, projectId, existingProject = null) {
  const draft = validateCreatorDraft(draftInput);
  if (!draft || typeof projectId !== "string") {
    throw new TypeError("A valid Creator Studio draft and cloud project ID are required.");
  }

  const previous = validateStudioProject(existingProject);
  const base = previous || createStudioProject({
    id: projectId,
    title: draft.title,
    now: draft.updatedAt,
  });
  const scenes = draft.scenes.map((scene, index) => {
    const existing = base.scenes[index];
    return {
      id: scene.id,
      title: scene.title,
      duration: existing?.duration || base.settings.duration,
      layers: existing?.layers || [],
      motion: existing?.motion || [],
      objects3d: existing?.objects3d || [],
    };
  });
  const project = validateStudioProject({
    ...base,
    id: projectId,
    title: draft.title,
    updatedAt: draft.updatedAt,
    scenes,
  });
  if (!project) throw new TypeError("The shared project structure could not be validated.");

  return {
    schema: CREATOR_WORKSPACE_SCHEMA,
    version: 1,
    draft,
    project,
  };
}

export function readCreatorWorkspaceDocument(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  if (input.schema === CREATOR_WORKSPACE_SCHEMA) {
    const draft = validateCreatorDraft(input.draft);
    const project = validateStudioProject(input.project);
    if (!draft || !project || project.scenes.length !== draft.scenes.length) return null;
    return { schema: CREATOR_WORKSPACE_SCHEMA, version: 1, draft, project };
  }

  // Backward compatibility for cloud drafts saved before the unified project format.
  const legacyDraft = validateCreatorDraft(input);
  if (!legacyDraft) return null;
  return { schema: CREATOR_WORKSPACE_SCHEMA, version: 1, draft: legacyDraft, project: null };
}
