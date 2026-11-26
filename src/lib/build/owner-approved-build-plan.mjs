import { createHash } from "node:crypto";
import { validateCreativeBuildTargetPath } from "./creative-build-task-proposals.mjs";

const MAX_FILES = 12;
const MAX_DIFF_BYTES = 256 * 1024;
const MAX_TESTS = 20;
const HASH = /^[a-f0-9]{40}$/i;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;

function stable(value) {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + stable(value[key])).join(",") + "}";
  }
  return JSON.stringify(value);
}

function exactKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).sort().join("|") === [...keys].sort().join("|");
}

/**
 * Validate a narrow, owner-approved autonomous build plan.
 * This is a contract only: it does not execute code, write files, call providers,
 * create PRs, merge, deploy, or change any external system.
 */
export function createOwnerApprovedBuildPlan({
  taskId, ownerId, approvalId, approvedAt, baseSha, changes, tests,
  diffBytes = 0, permissions,
} = {}) {
  if (typeof taskId !== "string" || !ID.test(taskId) ||
      typeof ownerId !== "string" || !ID.test(ownerId) ||
      typeof approvalId !== "string" || !ID.test(approvalId) ||
      !Number.isFinite(approvedAt) || approvedAt <= 0 ||
      typeof baseSha !== "string" || !HASH.test(baseSha)) {
    throw new TypeError("A task, owner, explicit approval, timestamp and pinned base commit are required.");
  }
  if (!Array.isArray(changes) || changes.length < 1 || changes.length > MAX_FILES ||
      !Array.isArray(tests) || tests.length < 1 || tests.length > MAX_TESTS ||
      !Number.isSafeInteger(diffBytes) || diffBytes < 0 || diffBytes > MAX_DIFF_BYTES) {
    throw new RangeError("The approved build plan exceeds its bounded file, test or diff limits.");
  }
  if (!exactKeys(permissions, [
    "creativeBuildPathsOnly", "studentMode", "auth", "supabaseSchema",
    "dependencies", "secrets", "deployment", "merge",
  ]) ||
      permissions.creativeBuildPathsOnly !== true ||
      Object.entries(permissions).some(([key, value]) => key !== "creativeBuildPathsOnly" && value !== false)) {
    throw new Error("The build plan requests permissions outside the isolated draft-only scope.");
  }

  const seen = new Set();
  const normalizedChanges = changes.map((change) => {
    if (!exactKeys(change, ["path", "operation", "contentSha256"]) ||
        !["create", "update"].includes(change.operation) ||
        typeof change.contentSha256 !== "string" || !/^[a-f0-9]{64}$/i.test(change.contentSha256)) {
      throw new TypeError("Each build change must be a bounded create/update with a content digest.");
    }
    const path = validateCreativeBuildTargetPath(change.path);
    if (seen.has(path)) throw new Error("Build plan target paths must be unique.");
    seen.add(path);
    return Object.freeze({ path, operation: change.operation, contentSha256: change.contentSha256.toLowerCase() });
  }).sort((a, b) => a.path.localeCompare(b.path));

  const normalizedTests = tests.map((name) => {
    if (typeof name !== "string" || !/^src\/lib\/(?:creative|build)\/[A-Za-z0-9._/-]+\.test\.(?:mjs|js|jsx|ts|tsx)$/.test(name)) {
      throw new Error("Every required test must be inside the approved creative/build test scope.");
    }
    validateCreativeBuildTargetPath(name);
    return name;
  });
  if (new Set(normalizedTests).size !== normalizedTests.length) throw new Error("Required tests must be unique.");
  normalizedTests.sort();

  const body = {
    taskId, ownerId, approvalId, approvedAt, baseSha: baseSha.toLowerCase(),
    changes: normalizedChanges, tests: normalizedTests, diffBytes,
    permissions: Object.freeze({ ...permissions }),
    execution: Object.freeze({
      mode: "isolated-draft-pr",
      runTests: true,
      writesAllowed: true,
      studentModeAccess: false,
      authAccess: false,
      supabaseSchemaAccess: false,
      dependencyChangesAllowed: false,
      secretAccess: false,
      mergeAllowed: false,
      deploymentAllowed: false,
      providerCallsAllowed: false,
    }),
  };
  const digest = createHash("sha256").update(stable(body)).digest("hex");
  return Object.freeze({ ...body, planDigest: digest });
}

/** Verify a plan has not been edited after owner approval. */
export function verifyOwnerApprovedBuildPlan(plan) {
  try {
    if (!exactKeys(plan, [
      "taskId", "ownerId", "approvalId", "approvedAt", "baseSha",
      "changes", "tests", "diffBytes", "permissions", "execution", "planDigest",
    ]) || typeof plan.planDigest !== "string") return false;
    const { planDigest, ...body } = plan;
    const recreated = createOwnerApprovedBuildPlan(body);
    return recreated.planDigest === planDigest &&
      stable(recreated) === stable(plan);
  } catch {
    return false;
  }
}
