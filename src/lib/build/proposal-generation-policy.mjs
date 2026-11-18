import { prepareChangeProposalDraft } from "./proposal-draft-policy.mjs";
import { validateChangeProposal } from "./change-proposal-policy.mjs";

/**
 * Validates a generated draft against the full server snapshot while preventing
 * updates/deletes to files whose complete contents were not sent to the model.
 * Pure validation only; never persists or applies source files.
 */
export function prepareValidatedProposal({ currentFiles, modelVisiblePaths, draft } = {}) {
  if (!(modelVisiblePaths instanceof Set)) {
    throw new Error("The model-visible source path set is required.");
  }
  if (!Array.isArray(currentFiles)) {
    throw new Error("The current project snapshot is required.");
  }
  if (Array.isArray(draft?.changes)) {
    for (const change of draft.changes) {
      if (change?.action === "update" || change?.action === "delete") {
        if (!modelVisiblePaths.has(change.path)) {
          throw new Error(
            "Aahana cannot safely update a file whose complete source was not included in the proposal context: " +
            String(change.path || "unknown path"),
          );
        }
      }
    }
  }
  const normalizedDraft = prepareChangeProposalDraft({ currentFiles, draft });
  const proposal = validateChangeProposal({
    currentFiles,
    changes: normalizedDraft.changes,
  });
  return Object.freeze({
    ...proposal,
    summary: normalizedDraft.summary,
  });
}
