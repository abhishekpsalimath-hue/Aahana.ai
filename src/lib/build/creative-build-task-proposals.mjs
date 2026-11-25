import { createHash } from "node:crypto";

const ALLOWED_ROOTS = Object.freeze(["src/lib/creative/", "src/lib/build/"]);
const BLOCKED_PATH = /(?:^|\/)(?:auth|student(?:-mode)?|supabase|migrations?|\.github|\.vercel|node_modules|vendor)(?:\/|$)|(?:^|\/)(?:package(?:-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|\.env(?:\.|$))/i;
const MAX_TASKS = 50;
const MAX_PATHS_PER_TASK = 12;

function stableJson(value) {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + stableJson(value[key])).join(",") + "}";
  }
  return JSON.stringify(value);
}

export function validateCreativeBuildTargetPath(path) {
  if (typeof path !== "string" || path.length > 240 || path.startsWith("/") ||
      path.includes("\\") || /[\u0000-\u001f\u007f]/u.test(path)) {
    throw new Error("Build task target must be a safe relative source path.");
  }
  if (BLOCKED_PATH.test(path) || !ALLOWED_ROOTS.some((root) => path.startsWith(root)) ||
      path.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("Build task target is outside the approved creative and build-internals scope.");
  }
  if (!/\.(?:mjs|js|jsx|ts|tsx|css|md)$/i.test(path)) {
    throw new Error("Build task targets must be source or documentation files.");
  }
  return path;
}

/**
 * Convert evidence-backed creative recommendations into reviewable, draft-only
 * tasks. This adapter never reads user files, writes a repository, runs code,
 * invokes a provider, or accepts/merges/deploys a change.
 */
export function createCreativeBuildTaskProposals({ improvementReport, targetPathsByProposal = {} } = {}) {
  if (!improvementReport || !Array.isArray(improvementReport.proposals) ||
      improvementReport.proposalCount !== improvementReport.proposals.length) {
    throw new TypeError("A valid creative improvement report is required.");
  }
  if (improvementReport.proposals.length > MAX_TASKS) {
    throw new Error("The improvement report exceeds the build-task proposal limit.");
  }
  if (!targetPathsByProposal || typeof targetPathsByProposal !== "object" || Array.isArray(targetPathsByProposal)) {
    throw new TypeError("Target path assignments must be an object keyed by proposal ID.");
  }

  const seen = new Set();
  const tasks = improvementReport.proposals.map((proposal) => {
    if (!proposal || typeof proposal.id !== "string" || !/^[a-z0-9-]{3,100}$/i.test(proposal.id) ||
        typeof proposal.title !== "string" || typeof proposal.action !== "string" ||
        !["high", "medium", "low"].includes(proposal.priority) ||
        !proposal.evidence || typeof proposal.evidence !== "object" || Array.isArray(proposal.evidence)) {
      throw new TypeError("The improvement report contains a malformed proposal.");
    }
    if (seen.has(proposal.id)) throw new Error("Improvement proposal IDs must be unique.");
    seen.add(proposal.id);

    const assigned = targetPathsByProposal[proposal.id] ?? [];
    if (!Array.isArray(assigned) || assigned.length > MAX_PATHS_PER_TASK) {
      throw new Error("Each build task may target at most 12 approved source paths.");
    }
    const targetPaths = [...new Set(assigned.map(validateCreativeBuildTargetPath))].sort();
    if (targetPaths.length !== assigned.length) throw new Error("Build task target paths must be unique.");

    const sourceEvidence = Object.freeze({
      source: typeof proposal.source === "string" ? proposal.source : "unspecified",
      evidence: Object.freeze({ ...proposal.evidence }),
    });
    const identity = stableJson({ proposalId: proposal.id, sourceEvidence, targetPaths });
    const taskId = "creative-task-" + createHash("sha256").update(identity).digest("hex").slice(0, 20);

    return Object.freeze({
      taskId,
      proposalId: proposal.id,
      title: proposal.title,
      priority: proposal.priority,
      action: proposal.action,
      sourceEvidence,
      targetPaths: Object.freeze(targetPaths),
      status: "awaiting-owner-review",
      approval: Object.freeze({ required: true, status: "pending" }),
      execution: Object.freeze({
        mode: "draft-only",
        writesAllowed: false,
        testsRequiredBeforeAcceptance: true,
        automaticAcceptance: false,
        mergeAllowed: false,
        deploymentAllowed: false,
      }),
    });
  });

  return Object.freeze({
    scope: "Evidence-backed task proposals only; owner review required; approved creative/build source paths only; no repository writes or execution.",
    taskCount: tasks.length,
    tasks: Object.freeze(tasks),
  });
}
