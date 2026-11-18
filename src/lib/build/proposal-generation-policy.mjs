import { prepareChangeProposalDraft } from "./proposal-draft-policy.mjs";
import { validateChangeProposal } from "./change-proposal-policy.mjs";
import { analyzeProjectContracts, analyzeProjectDependencies } from "./project-dependency-policy.mjs";


function contractKey(item) {
  return JSON.stringify([item.from, item.to, item.imported, item.local]);
}

function unresolvedImportKey(item) {
  return JSON.stringify([item.from, item.specifier]);
}

/**
 * Rejects only newly introduced, statically visible local contract breaks.
 * Existing unresolved edges are tolerated so legacy project debt does not block
 * an otherwise safe proposal. This is not a compiler or type checker.
 */
export function validateProposalContracts({ currentFiles, proposalChanges } = {}) {
  if (!Array.isArray(currentFiles) || !Array.isArray(proposalChanges)) {
    throw new Error("A project snapshot and validated proposal changes are required.");
  }
  const proposedByPath = new Map(currentFiles.map((file) => [file.path, file.content]));
  for (const change of proposalChanges) {
    if (change.action === "delete") proposedByPath.delete(change.path);
    else proposedByPath.set(change.path, change.after);
  }
  const proposedFiles = [...proposedByPath].map(([path, content]) => ({ path, content }));
  const beforeContracts = analyzeProjectContracts(currentFiles);
  const afterContracts = analyzeProjectContracts(proposedFiles);
  const beforeUnresolvedBindings = new Set(beforeContracts.unresolvedBindings.map(contractKey));
  const introducedBindings = afterContracts.unresolvedBindings.filter((item) => !beforeUnresolvedBindings.has(contractKey(item)));
  if (introducedBindings.length) {
    const details = introducedBindings.slice(0, 5)
      .map((item) => item.from + " imports missing " + item.imported + " from " + item.to)
      .join("; ");
    throw new Error("The proposal introduces a broken module export contract: " + details);
  }

  const beforeDependencies = analyzeProjectDependencies(currentFiles);
  const afterDependencies = analyzeProjectDependencies(proposedFiles);
  const beforeUnresolvedImports = new Set(beforeDependencies.unresolved.map(unresolvedImportKey));
  const introducedImports = afterDependencies.unresolved.filter((item) => {
    const pathLike = item.specifier.startsWith(".") || item.specifier.startsWith("/");
    const hasExtension = /\\.[^/]+$/.test(item.specifier);
    const supportedSource = !hasExtension || /\\.(?:[cm]?[jt]sx?|json|css|svg)$/i.test(item.specifier);
    return pathLike && supportedSource && !beforeUnresolvedImports.has(unresolvedImportKey(item));
  });
  if (introducedImports.length) {
    const details = introducedImports.slice(0, 5)
      .map((item) => item.from + " imports missing local file " + item.specifier)
      .join("; ");
    throw new Error("The proposal introduces unresolved local source imports: " + details);
  }
  return Object.freeze({
    checkedFiles: proposedFiles.length,
    introducedBrokenBindings: 0,
    introducedUnresolvedLocalImports: 0,
    staticAnalysisOnly: true,
  });
}

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
  const contractCheck = validateProposalContracts({
    currentFiles,
    proposalChanges: proposal.changes,
  });
  return Object.freeze({
    ...proposal,
    summary: normalizedDraft.summary,
    contractCheck,
  });
}
