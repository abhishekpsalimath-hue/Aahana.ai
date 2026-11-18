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

test("rejects a merged snapshot that exceeds the sandbox total-byte limit", () => {
  const currentFiles = Array.from({ length: 4 }, (_, index) => ({
    path: "src/file-" + index + ".js",
    content: "x".repeat(800 * 1024),
  }));
  const proposal = validateChangeProposal({
    currentFiles,
    changes: [{
      path: "src/new.js",
      action: "create",
      baseSha256: null,
      content: "export const added = true;",
    }],
  });
  assert.throws(() => prepareIsolatedProposalWorkspace({ currentFiles, proposal }), /3 MB/);
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
