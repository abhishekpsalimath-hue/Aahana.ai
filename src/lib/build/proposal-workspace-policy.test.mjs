import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { validateChangeProposal } from "./change-proposal-policy.mjs";
import { prepareIsolatedProposalWorkspace } from "./proposal-workspace-policy.mjs";

const hash = (value) => createHash("sha256").update(value, "utf8").digest("hex");

test("materializes a proposal into an isolated in-memory workspace without writes", () => {
  const currentFiles = [
    { path: "package.json", content: JSON.stringify({ scripts: { build: "node build.js" } }) },
    { path: "src/app.js", content: "export const value = 1;" },
    { path: "src/old.js", content: "export const old = true;" },
  ];
  const proposal = validateChangeProposal({
    currentFiles,
    changes: [
      { path: "src/app.js", action: "update", baseSha256: hash(currentFiles[1].content), content: "export const value = 2;" },
      { path: "src/new.js", action: "create", baseSha256: null, content: "export const fresh = true;" },
      { path: "src/old.js", action: "delete", baseSha256: hash(currentFiles[2].content) },
    ],
  });
  const workspace = prepareIsolatedProposalWorkspace({ currentFiles, proposal });
  assert.equal(workspace.fileCount, 3);
  assert.equal(workspace.files.find((file) => file.path === "src/app.js").content, "export const value = 2;");
  assert.equal(workspace.files.some((file) => file.path === "src/new.js"), true);
  assert.equal(workspace.files.some((file) => file.path === "src/old.js"), false);
  assert.equal(workspace.writesPerformed, false);
  assert.equal(workspace.sandboxStarted, false);
  assert.equal(workspace.contractCheck.staticAnalysisOnly, true);
});

test("rejects a workspace whose merged snapshot exceeds sandbox file limits", () => {
  const currentFiles = [{ path: "src/app.js", content: "export const app = true;" }];
  const proposal = validateChangeProposal({
    currentFiles,
    changes: [{
      path: "src/large.js",
      action: "create",
      baseSha256: null,
      content: "x".repeat(1024 * 1024),
    }],
  });
  assert.throws(() => prepareIsolatedProposalWorkspace({ currentFiles, proposal }), /3 MB|100 files/);
});

test("rejects malformed inputs and broken cross-file contracts", () => {
  assert.throws(() => prepareIsolatedProposalWorkspace({ currentFiles: [], proposal: null }));
  const currentFiles = [
    { path: "src/lib/value.js", content: "export const value = true;" },
    { path: "src/page.js", content: 'import { value } from "./lib/value";' },
  ];
  const proposal = validateChangeProposal({
    currentFiles,
    changes: [{
      path: "src/page.js",
      action: "update",
      baseSha256: hash(currentFiles[1].content),
      content: 'import { missing } from "./lib/value";',
    }],
  });
  assert.throws(() => prepareIsolatedProposalWorkspace({ currentFiles, proposal }), /broken module export contract/);
});
