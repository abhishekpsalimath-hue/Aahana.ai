import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateAutonomousDiff,
  validateAutonomousTask,
} from "./autonomous-development-policy.mjs";

const taskInput = {
  taskId: "task_policy_001",
  repository: "abhishekpsalimath-hue/Aahana.ai",
  baseBranch: "main",
  allowedPaths: ["src/features/", "docs/product-notes/"],
  acceptanceCriteria: [
    "The requested feature behaves as specified.",
    "Relevant automated tests pass.",
  ],
};

const passingEvidence = [{ command: "npm test -- --runInBand", exitCode: 0 }];

test("accepts a bounded task with explicit scope and acceptance criteria", () => {
  const task = validateAutonomousTask(taskInput);
  assert.equal(task.repository, "abhishekpsalimath-hue/Aahana.ai");
  assert.deepEqual(task.allowedPaths, ["src/features/", "docs/product-notes/"]);
  assert.equal(Object.isFrozen(task), true);
  assert.equal(Object.isFrozen(task.allowedPaths), true);
});

test("rejects malformed task identity, repository and branch values", () => {
  assert.throws(() => validateAutonomousTask({ ...taskInput, taskId: "../unsafe" }));
  assert.throws(() => validateAutonomousTask({ ...taskInput, repository: "https://github.com/org/repo" }));
  assert.throws(() => validateAutonomousTask({ ...taskInput, baseBranch: "../main" }));
  assert.throws(() => validateAutonomousTask({ ...taskInput, baseBranch: "main//other" }));
});

test("requires unique, bounded, non-empty scope and acceptance criteria", () => {
  assert.throws(() => validateAutonomousTask({ ...taskInput, allowedPaths: [] }));
  assert.throws(() => validateAutonomousTask({ ...taskInput, allowedPaths: ["src/features/", "src/features/"] }));
  assert.throws(() => validateAutonomousTask({ ...taskInput, allowedPaths: ["../secrets/"] }));
  assert.throws(() => validateAutonomousTask({ ...taskInput, allowedPaths: ["package.json"] }));
  assert.throws(() => validateAutonomousTask({ ...taskInput, allowedPaths: [".github/workflows/"] }));
  assert.throws(() => validateAutonomousTask({ ...taskInput, acceptanceCriteria: [" "] }));
});

test("accepts a small diff inside the exact task allowlist with server-recorded passing evidence", () => {
  const result = evaluateAutonomousDiff({
    task: taskInput,
    files: [{ path: "src/features/search.js", changeType: "added", patch: "+export function search() { return []; }" }],
    evidence: passingEvidence,
  });
  assert.equal(result.status, "accepted");
  assert.deepEqual(result.reasons, []);
});

test("rejects a diff outside the task allowlist", () => {
  const result = evaluateAutonomousDiff({
    task: taskInput,
    files: [{ path: "src/app/api/auth/route.js", changeType: "modified", patch: "+// change" }],
    evidence: passingEvidence,
  });
  assert.equal(result.status, "rejected");
  assert.ok(result.reasons.includes("changed_path_outside_task_allowlist"));
});

test("rejects unsafe paths and secret-like material in a diff", () => {
  const traversal = evaluateAutonomousDiff({
    task: taskInput,
    files: [{ path: "src/features/../../.env", changeType: "added", patch: "+value" }],
    evidence: passingEvidence,
  });
  assert.equal(traversal.status, "rejected");
  assert.ok(traversal.reasons.includes("unsafe_changed_path"));

  const secret = evaluateAutonomousDiff({
    task: taskInput,
    files: [{ path: "src/features/config.js", changeType: "added", patch: "+const token = \"ghp_123456789012345678901234567890\";" }],
    evidence: passingEvidence,
  });
  assert.equal(secret.status, "rejected");
  assert.ok(secret.reasons.includes("possible_secret_in_diff"));
});

test("rejects missing or failing server-recorded test evidence", () => {
  const files = [{ path: "src/features/search.js", changeType: "modified", patch: "+export const enabled = true;" }];
  assert.equal(evaluateAutonomousDiff({ task: taskInput, files, evidence: [] }).status, "rejected");
  assert.equal(evaluateAutonomousDiff({
    task: taskInput, files, evidence: [{ command: "npm test", exitCode: 1 }],
  }).status, "rejected");
});

test("requires owner approval for file deletion or rename", () => {
  for (const changeType of ["deleted", "renamed"]) {
    const result = evaluateAutonomousDiff({
      task: taskInput,
      files: [{ path: "src/features/old.js", changeType, patch: "-old content" }],
      evidence: passingEvidence,
    });
    assert.equal(result.status, "approval_required");
    assert.ok(result.reasons.includes("delete_or_rename_requires_owner_approval"));
  }
});

test("enforces per-file and aggregate diff size limits", () => {
  const oversizedFile = evaluateAutonomousDiff({
    task: taskInput,
    files: [{ path: "src/features/large.js", changeType: "added", patch: "x".repeat(30 * 1024 + 1) }],
    evidence: passingEvidence,
  });
  assert.equal(oversizedFile.status, "rejected");
  assert.ok(oversizedFile.reasons.includes("per_file_patch_limit_exceeded"));

  const tooMany = Array.from({ length: 51 }, (_, index) => ({
    path: `src/features/file-${index}.js`, changeType: "added", patch: "+x",
  }));
  assert.equal(evaluateAutonomousDiff({ task: taskInput, files: tooMany, evidence: passingEvidence }).status, "rejected");
});
