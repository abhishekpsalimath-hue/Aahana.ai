import { validateWorkspaceFiles } from "./sandbox-policy.mjs";
import { validateProposalContracts } from "./proposal-generation-policy.mjs";

/**
 * Materializes a validated proposal into an in-memory, bounded workspace copy.
 * It never writes to storage or starts a Sandbox execution.
 */
export function prepareIsolatedProposalWorkspace({ currentFiles, proposal } = {}) {
  if (!Array.isArray(currentFiles) || !Array.isArray(proposal?.changes)) {
    throw new Error("A validated proposal and current project snapshot are required.");
  }
  const nextByPath = new Map(currentFiles.map((file) => [file.path, file.content]));
  for (const change of proposal.changes) {
    if (change.action === "delete") nextByPath.delete(change.path);
    else nextByPath.set(change.path, change.after);
  }
  const files = validateWorkspaceFiles(
    [...nextByPath].map(([path, content]) => ({ path, content })),
  );
  const contractCheck = validateProposalContracts({
    currentFiles,
    proposalChanges: proposal.changes,
  });
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  return Object.freeze({
    files,
    fileCount: files.length,
    totalBytes,
    contractCheck,
    writesPerformed: false,
    sandboxStarted: false,
  });
}
