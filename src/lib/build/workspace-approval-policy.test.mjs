import test from "node:test";
import assert from "node:assert/strict";
import {
  authorizeWorkspaceExecution,
  createWorkspaceDigest,
} from "./workspace-approval-policy.mjs";

const files = [
  { path: "package.json", content: JSON.stringify({ scripts: { build: "node build.js" } }) },
  { path: "src/app.js", content: "console.log('safe');" },
];
const base = {
  userId: "owner-1",
  projectOwnerId: "owner-1",
  projectId: "project-1",
  files,
  operation: "build",
  entrypoint: undefined,
};
const approval = {
  approved: true,
  projectId: "project-1",
  operation: "build",
  entrypoint: null,
  workspaceDigest: createWorkspaceDigest(files),
};

test("allows the authenticated owner to approve the exact workspace and operation", () => {
  const result = authorizeWorkspaceExecution({ ...base, approval });
  assert.equal(result.authorized, true);
  assert.equal(result.workspaceDigest, approval.workspaceDigest);
  assert.equal(result.operation, "build");
});

test("rejects missing or false explicit approval", () => {
  assert.throws(() => authorizeWorkspaceExecution({ ...base }), /Explicit owner approval/);
  assert.throws(() => authorizeWorkspaceExecution({
    ...base,
    approval: { ...approval, approved: false },
  }), /Explicit owner approval/);
});

test("rejects a non-owner even when an approval object is supplied", () => {
  assert.throws(() => authorizeWorkspaceExecution({
    ...base,
    userId: "other-user",
    approval,
  }), /authenticated project owner/);
});

test("rejects changed workspace content and changed file paths", () => {
  assert.throws(() => authorizeWorkspaceExecution({
    ...base,
    files: [...files, { path: "src/extra.js", content: "unexpected();" }],
    approval,
  }), /workspace changed after approval/);
  assert.throws(() => authorizeWorkspaceExecution({
    ...base,
    files: [{ ...files[0] }, { path: "src/app.js", content: "changed();" }],
    approval,
  }), /workspace changed after approval/);
});

test("rejects approval for a different project, operation, or entrypoint", () => {
  assert.throws(() => authorizeWorkspaceExecution({
    ...base,
    projectId: "project-2",
    approval,
  }), /does not match this project and operation/);
  assert.throws(() => authorizeWorkspaceExecution({
    ...base,
    operation: "test",
    approval,
  }), /does not match this project and operation/);
  assert.throws(() => authorizeWorkspaceExecution({
    ...base,
    operation: "run",
    entrypoint: "src/app.js",
    approval: { ...approval, operation: "run" },
  }), /does not match the selected entrypoint/);
});

test("workspace digest is stable regardless of input file order", () => {
  assert.equal(createWorkspaceDigest(files), createWorkspaceDigest([...files].reverse()));
});

test("rejects malformed workspace data before authorizing", () => {
  assert.throws(() => createWorkspaceDigest([{ path: "../escape.js", content: "x" }]));
  assert.throws(() => authorizeWorkspaceExecution({
    ...base,
    approval: { ...approval, workspaceDigest: "not-a-digest" },
  }), /workspace changed after approval/);
});
