import { createHash } from "node:crypto";
import { validateWorkspaceFiles } from "./sandbox-policy.mjs";

const ALLOWED_OPERATIONS = new Set(["build", "test", "run"]);

export function createWorkspaceDigest(files) {
  const validated = validateWorkspaceFiles(files);
  const canonical = validated
    .map(({ path, content }) => ({ path, content }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return createHash("sha256")
    .update(JSON.stringify(canonical), "utf8")
    .digest("hex");
}

/**
 * Verifies that the authenticated project owner explicitly approved this exact
 * workspace and operation. This is a request-time consent gate, not a
 * cryptographic signature or a substitute for authentication/ownership checks.
 */
export function authorizeWorkspaceExecution({
  userId,
  projectOwnerId,
  projectId,
  approval,
  files,
  operation,
  entrypoint,
} = {}) {
  if (typeof userId !== "string" || !userId ||
      typeof projectOwnerId !== "string" || !projectOwnerId ||
      userId !== projectOwnerId) {
    throw new Error("Only the authenticated project owner can approve workspace execution.");
  }
  if (typeof projectId !== "string" || !projectId) {
    throw new Error("A valid project is required for workspace approval.");
  }
  if (!ALLOWED_OPERATIONS.has(operation)) {
    throw new Error("The requested workspace operation is not permitted.");
  }
  if (!approval || approval.approved !== true) {
    throw new Error("Explicit owner approval is required before running workspace code.");
  }
  if (approval.projectId !== projectId || approval.operation !== operation) {
    throw new Error("Approval does not match this project and operation.");
  }
  const normalizedEntrypoint = typeof entrypoint === "string" ? entrypoint : null;
  if ((approval.entrypoint ?? null) !== normalizedEntrypoint) {
    throw new Error("Approval does not match the selected entrypoint.");
  }

  const workspaceDigest = createWorkspaceDigest(files);
  if (typeof approval.workspaceDigest !== "string" ||
      !/^[a-f0-9]{64}$/i.test(approval.workspaceDigest) ||
      approval.workspaceDigest !== workspaceDigest) {
    throw new Error("The workspace changed after approval. Review and approve the current files again.");
  }

  return Object.freeze({
    authorized: true,
    projectId,
    operation,
    entrypoint: normalizedEntrypoint,
    workspaceDigest,
  });
}
