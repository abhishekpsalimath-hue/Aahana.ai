import { createHash } from "node:crypto";

const ALLOWED_ROOTS = Object.freeze(["src/lib/creative/", "src/lib/build/"]);
const BLOCKED_PATH = /(?:^|\/)(?:auth|student(?:-mode)?|supabase|migrations?|\.github|\.vercel|node_modules|vendor)(?:\/|$)|(?:^|\/)(?:package(?:-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|\.env(?:\.|$))/i;
const MAX_TASKS = 50;
const MAX_PATHS_PER_TASK = 12;
const MAX_TITLE_LENGTH = 160;
const MAX_ACTION_LENGTH = 1000;
const MAX_SOURCE_LENGTH = 80;
const MAX_EVIDENCE_BYTES = 8192;

function freezeJson(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freezeJson(child);
    Object.freeze(value);
  }
  return value;
}

function normalizeEvidence(evidence) {
  let serialized;
  try {
    serialized = JSON.stringify(evidence);
  } catch {
    throw new TypeError("Proposal evidence must be serializable JSON.");
  }
  if (typeof serialized !== "string") {
    throw new TypeError("Proposal evidence must serialize to a JSON object.");
  }
  if (new TextEncoder().encode(serialized).byteLength > MAX_EVIDENCE_BYTES) {
    throw new Error("Proposal evidence exceeds the 8 KB task limit.");
  }
  let normalized;
  try {
    normalized = JSON.parse(serialized);
  } catch {
    throw new TypeError("Proposal evidence must be valid JSON.");
  }
  if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
    throw new TypeError("Proposal evidence must serialize to a JSON object.");
  }
  return freezeJson(normalized);
}

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
        typeof proposal.title !== "string" || !proposal.title.trim() || proposal.title.length > MAX_TITLE_LENGTH ||
        typeof proposal.action !== "string" || !proposal.action.trim() || proposal.action.length > MAX_ACTION_LENGTH ||
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

    const normalizedEvidence = normalizeEvidence(proposal.evidence);
    const source = typeof proposal.source === "string" ? proposal.source : "unspecified";
    if (!source.trim() || source.length > MAX_SOURCE_LENGTH) {
      throw new TypeError("Proposal source must be a non-empty label of at most 80 characters.");
    }
    const sourceEvidence = Object.freeze({
      source,
      evidence: normalizedEvidence,
    });
    const identity = stableJson({ proposalId: proposal.id, title: proposal.title, priority: proposal.priority, action: proposal.action, sourceEvidence, targetPaths });
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


/**
 * Verify that a task is an unchanged product of the proposal adapter.
 * This detects client-edited evidence, paths, IDs and permission flags before
 * a review decision is accepted by a future authenticated server boundary.
 */
function hasExactKeys(value, expected) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).sort().join("|") === [...expected].sort().join("|");
}

/**
 * Verify the task's canonical shape, bounded JSON evidence and stable identity.
 * The digest detects accidental or partial edits; it is not an authentication
 * signature. A future server must load the original task from trusted storage.
 */
export function verifyCreativeBuildTaskProposal(task) {
  try {
    if (!hasExactKeys(task, [
      "taskId", "proposalId", "title", "priority", "action",
      "sourceEvidence", "targetPaths", "status", "approval", "execution",
    ]) ||
        typeof task.taskId !== "string" ||
        typeof task.proposalId !== "string" || !/^[a-z0-9-]{3,100}$/i.test(task.proposalId) ||
        typeof task.title !== "string" || !task.title.trim() || task.title.length > MAX_TITLE_LENGTH ||
        typeof task.action !== "string" || !task.action.trim() || task.action.length > MAX_ACTION_LENGTH ||
        !["high", "medium", "low"].includes(task.priority) ||
        !hasExactKeys(task.sourceEvidence, ["source", "evidence"]) ||
        typeof task.sourceEvidence.source !== "string" ||
        !task.sourceEvidence.source.trim() || task.sourceEvidence.source.length > MAX_SOURCE_LENGTH ||
        !task.sourceEvidence.evidence || typeof task.sourceEvidence.evidence !== "object" ||
        Array.isArray(task.sourceEvidence.evidence) ||
        !Array.isArray(task.targetPaths) || task.targetPaths.length > MAX_PATHS_PER_TASK ||
        task.status !== "awaiting-owner-review" ||
        !hasExactKeys(task.approval, ["required", "status"]) ||
        task.approval.required !== true || task.approval.status !== "pending" ||
        !hasExactKeys(task.execution, [
          "mode", "writesAllowed", "testsRequiredBeforeAcceptance",
          "automaticAcceptance", "mergeAllowed", "deploymentAllowed",
        ]) ||
        task.execution.mode !== "draft-only" ||
        task.execution.writesAllowed !== false ||
        task.execution.testsRequiredBeforeAcceptance !== true ||
        task.execution.automaticAcceptance !== false ||
        task.execution.mergeAllowed !== false ||
        task.execution.deploymentAllowed !== false) return false;

    const serializedEvidence = JSON.stringify(task.sourceEvidence.evidence);
    if (typeof serializedEvidence !== "string" ||
        new TextEncoder().encode(serializedEvidence).byteLength > MAX_EVIDENCE_BYTES) return false;
    const normalizedEvidence = JSON.parse(serializedEvidence);
    if (!normalizedEvidence || typeof normalizedEvidence !== "object" || Array.isArray(normalizedEvidence)) return false;

    const paths = task.targetPaths.map(validateCreativeBuildTargetPath);
    if (new Set(paths).size !== paths.length ||
        paths.some((path, index) => path !== [...paths].sort()[index])) return false;
    const canonicalSourceEvidence = {
      source: task.sourceEvidence.source,
      evidence: normalizedEvidence,
    };
    const identity = stableJson({
      proposalId: task.proposalId,
      title: task.title,
      priority: task.priority,
      action: task.action,
      sourceEvidence: canonicalSourceEvidence,
      targetPaths: paths,
    });
    const expected = "creative-task-" + createHash("sha256").update(identity).digest("hex").slice(0, 20);
    return task.taskId === expected;
  } catch {
    return false;
  }
}

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
        typeof proposal.title !== "string" || !proposal.title.trim() || proposal.title.length > MAX_TITLE_LENGTH ||
        typeof proposal.action !== "string" || !proposal.action.trim() || proposal.action.length > MAX_ACTION_LENGTH ||
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

    let evidenceBytes;
    try {
      evidenceBytes = new TextEncoder().encode(JSON.stringify(proposal.evidence)).byteLength;
    } catch {
      throw new TypeError("Proposal evidence must be serializable JSON.");
    }
    if (evidenceBytes > MAX_EVIDENCE_BYTES) {
      throw new Error("Proposal evidence exceeds the 8 KB task limit.");
    }
    const source = typeof proposal.source === "string" ? proposal.source : "unspecified";
    if (!source.trim() || source.length > MAX_SOURCE_LENGTH) {
      throw new TypeError("Proposal source must be a non-empty label of at most 80 characters.");
    }
    const sourceEvidence = Object.freeze({
      source,
      evidence: Object.freeze({ ...proposal.evidence }),
    });
    const identity = stableJson({ proposalId: proposal.id, title: proposal.title, priority: proposal.priority, action: proposal.action, sourceEvidence, targetPaths });
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


/**
 * Verify that a task is an unchanged product of the proposal adapter.
 * This detects client-edited evidence, paths, IDs and permission flags before
 * a review decision is accepted by a future authenticated server boundary.
 */
function hasExactKeys(value, expected) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).sort().join("|") === [...expected].sort().join("|");
}

/**
 * Verify the task's canonical shape, bounded JSON evidence and stable identity.
 * The digest detects accidental or partial edits; it is not an authentication
 * signature. A future server must load the original task from trusted storage.
 */
export function verifyCreativeBuildTaskProposal(task) {
  try {
    if (!hasExactKeys(task, [
      "taskId", "proposalId", "title", "priority", "action",
      "sourceEvidence", "targetPaths", "status", "approval", "execution",
    ]) ||
        typeof task.taskId !== "string" ||
        typeof task.proposalId !== "string" || !/^[a-z0-9-]{3,100}$/i.test(task.proposalId) ||
        typeof task.title !== "string" || !task.title.trim() || task.title.length > MAX_TITLE_LENGTH ||
        typeof task.action !== "string" || !task.action.trim() || task.action.length > MAX_ACTION_LENGTH ||
        !["high", "medium", "low"].includes(task.priority) ||
        !hasExactKeys(task.sourceEvidence, ["source", "evidence"]) ||
        typeof task.sourceEvidence.source !== "string" ||
        !task.sourceEvidence.source.trim() || task.sourceEvidence.source.length > MAX_SOURCE_LENGTH ||
        !task.sourceEvidence.evidence || typeof task.sourceEvidence.evidence !== "object" ||
        Array.isArray(task.sourceEvidence.evidence) ||
        !Array.isArray(task.targetPaths) || task.targetPaths.length > MAX_PATHS_PER_TASK ||
        task.status !== "awaiting-owner-review" ||
        !hasExactKeys(task.approval, ["required", "status"]) ||
        task.approval.required !== true || task.approval.status !== "pending" ||
        !hasExactKeys(task.execution, [
          "mode", "writesAllowed", "testsRequiredBeforeAcceptance",
          "automaticAcceptance", "mergeAllowed", "deploymentAllowed",
        ]) ||
        task.execution.mode !== "draft-only" ||
        task.execution.writesAllowed !== false ||
        task.execution.testsRequiredBeforeAcceptance !== true ||
        task.execution.automaticAcceptance !== false ||
        task.execution.mergeAllowed !== false ||
        task.execution.deploymentAllowed !== false) return false;

    const serializedEvidence = JSON.stringify(task.sourceEvidence.evidence);
    if (typeof serializedEvidence !== "string" ||
        new TextEncoder().encode(serializedEvidence).byteLength > MAX_EVIDENCE_BYTES) return false;
    const normalizedEvidence = JSON.parse(serializedEvidence);
    if (!normalizedEvidence || typeof normalizedEvidence !== "object" || Array.isArray(normalizedEvidence)) return false;

    const paths = task.targetPaths.map(validateCreativeBuildTargetPath);
    if (new Set(paths).size !== paths.length ||
        paths.some((path, index) => path !== [...paths].sort()[index])) return false;
    const canonicalSourceEvidence = {
      source: task.sourceEvidence.source,
      evidence: normalizedEvidence,
    };
    const identity = stableJson({
      proposalId: task.proposalId,
      title: task.title,
      priority: task.priority,
      action: task.action,
      sourceEvidence: canonicalSourceEvidence,
      targetPaths: paths,
    });
    const expected = "creative-task-" + createHash("sha256").update(identity).digest("hex").slice(0, 20);
    return task.taskId === expected;
  } catch {
    return false;
  }
}
