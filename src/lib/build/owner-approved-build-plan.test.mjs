import test from "node:test";
import assert from "node:assert/strict";
import { createOwnerApprovedBuildPlan, verifyOwnerApprovedBuildPlan } from "./owner-approved-build-plan.mjs";

const permissions = {
  creativeBuildPathsOnly: true,
  studentMode: false,
  auth: false,
  supabaseSchema: false,
  dependencies: false,
  secrets: false,
  deployment: false,
  merge: false,
};
const input = {
  taskId: "creative-task-123",
  ownerId: "owner-123",
  approvalId: "approval-456",
  approvedAt: 1795800000000,
  baseSha: "a".repeat(40),
  changes: [{
    path: "src/lib/creative/creative-director.mjs",
    operation: "update",
    contentSha256: "b".repeat(64),
  }],
  tests: ["src/lib/creative/creative-director.test.mjs"],
  diffBytes: 4096,
  permissions,
};

test("creates a deterministic owner-approved isolated draft plan", () => {
  const plan = createOwnerApprovedBuildPlan(input);
  assert.equal(verifyOwnerApprovedBuildPlan(plan), true);
  assert.equal(plan.execution.mode, "isolated-draft-pr");
  assert.equal(plan.execution.mergeAllowed, false);
  assert.equal(plan.execution.deploymentAllowed, false);
  assert.equal(plan.execution.providerCallsAllowed, false);
  assert.equal(plan.execution.studentModeAccess, false);
  assert.equal(plan.planDigest, createOwnerApprovedBuildPlan(input).planDigest);
});

test("requires an explicit approval identity and pinned base SHA", () => {
  assert.throws(() => createOwnerApprovedBuildPlan({ ...input, approvalId: "" }), /approval/);
  assert.throws(() => createOwnerApprovedBuildPlan({ ...input, baseSha: "main" }), /pinned base/);
});

test("rejects protected paths, unsafe operations and duplicate targets", () => {
  for (const path of [
    "src/lib/supabase/server.js",
    "src/app/student-mode/page.jsx",
    "src/app/auth/page.jsx",
    "supabase/migrations/next.sql",
    ".github/workflows/build.yml",
    "src/lib/creative/../../auth/page.jsx",
  ]) {
    assert.throws(() => createOwnerApprovedBuildPlan({
      ...input, changes: [{ ...input.changes[0], path }],
    }));
  }
  assert.throws(() => createOwnerApprovedBuildPlan({
    ...input, changes: [input.changes[0], input.changes[0]],
  }), /unique/);
  assert.throws(() => createOwnerApprovedBuildPlan({
    ...input, changes: [{ ...input.changes[0], operation: "delete" }],
  }), /create\/update/);
});

test("rejects any privilege escalation, including nested or extra permission flags", () => {
  assert.throws(() => createOwnerApprovedBuildPlan({
    ...input, permissions: { ...permissions, deployment: true },
  }), /outside the isolated/);
  assert.throws(() => createOwnerApprovedBuildPlan({
    ...input, permissions: { ...permissions, canReadSecrets: true },
  }), /outside the isolated/);
});

test("requires approved-scope tests and bounded plans", () => {
  assert.throws(() => createOwnerApprovedBuildPlan({ ...input, tests: [] }), /limits/);
  assert.throws(() => createOwnerApprovedBuildPlan({
    ...input, tests: ["src/app/student-mode/student.test.js"],
  }), /approved creative\/build test scope/);
  assert.throws(() => createOwnerApprovedBuildPlan({ ...input, diffBytes: 300000 }), /limits/);
  assert.throws(() => createOwnerApprovedBuildPlan({
    ...input, changes: Array.from({ length: 13 }, (_, i) => ({
      path: "src/lib/creative/file-" + i + ".mjs",
      operation: "create", contentSha256: "c".repeat(64),
    })),
  }), /limits/);
});

test("detects post-approval edits to target files, test gates and permissions", () => {
  const plan = createOwnerApprovedBuildPlan(input);
  assert.equal(verifyOwnerApprovedBuildPlan({ ...plan, diffBytes: 100 }), false);
  assert.equal(verifyOwnerApprovedBuildPlan({
    ...plan, execution: { ...plan.execution, deploymentAllowed: true },
  }), false);
  assert.equal(verifyOwnerApprovedBuildPlan({
    ...plan, changes: [{ ...plan.changes[0], path: "src/lib/creative/other.mjs" }],
  }), false);
});
