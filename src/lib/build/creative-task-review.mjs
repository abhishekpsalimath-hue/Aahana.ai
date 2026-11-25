import { createHash } from "node:crypto";
import { validateCreativeBuildTargetPath, verifyCreativeBuildTaskProposal } from "./creative-build-task-proposals.mjs";

const DECISIONS = new Set(["approve-for-planning", "reject"]);

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * Record an explicit owner review decision for a draft task proposal.
 * Approval only permits the task to enter a future planning step; it never
 * authorizes file writes, code execution, provider calls, merges or deploys.
 * Persistence and identity verification belong to a separately authenticated
 * server boundary, not this pure policy helper.
 */
export function createCreativeTaskReviewDecision({
  task,
  decision,
  reviewerEmail,
  ownerEmail,
  reviewedAt = new Date().toISOString(),
} = {}) {
  const reviewer = normalizeEmail(reviewerEmail);
  const owner = normalizeEmail(ownerEmail);
  if (!owner || !reviewer || reviewer !== owner) {
    throw new Error("Only the configured Aahana owner may review creative build tasks.");
  }
  if (!verifyCreativeBuildTaskProposal(task)) {
    throw new TypeError("A valid pending, draft-only creative task is required.");
  }
  if (!DECISIONS.has(decision)) {
    throw new Error("Choose approve-for-planning or reject.");
  }
  if (!Array.isArray(task.targetPaths) || task.targetPaths.length > 12) {
    throw new Error("The task contains an invalid target path list.");
  }
  const targetPaths = task.targetPaths.map(validateCreativeBuildTargetPath);
  if (new Set(targetPaths).size !== targetPaths.length) {
    throw new Error("Creative task target paths must be unique.");
  }
  const timestamp = new Date(reviewedAt);
  if (!Number.isFinite(timestamp.getTime()) || timestamp.toISOString() !== reviewedAt) {
    throw new Error("Review timestamp must be a valid ISO-8601 UTC timestamp.");
  }

  const status = decision === "reject" ? "rejected" : "approved-for-planning";
  const identity = JSON.stringify({
    taskId: task.taskId,
    decision,
    reviewerEmail: reviewer,
    reviewedAt,
    targetPaths: [...targetPaths].sort(),
  });
  const decisionId = "creative-review-" + createHash("sha256").update(identity).digest("hex").slice(0, 20);

  return Object.freeze({
    decisionId,
    taskId: task.taskId,
    proposalId: task.proposalId,
    decision,
    status,
    reviewerEmail: reviewer,
    reviewedAt,
    targetPaths: Object.freeze([...targetPaths]),
    execution: Object.freeze({
      mode: "planning-only",
      writesAllowed: false,
      codeExecutionAllowed: false,
      providerCallsAllowed: false,
      automaticAcceptance: false,
      mergeAllowed: false,
      deploymentAllowed: false,
    }),
  });
}
