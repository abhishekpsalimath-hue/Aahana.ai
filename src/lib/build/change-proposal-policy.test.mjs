import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { validateChangeProposal } from "./change-proposal-policy.mjs";

const hash = (value) => createHash("sha256").update(value, "utf8").digest("hex");

test("creates a reviewable proposal without writing files", () => {
  const result = validateChangeProposal({
    currentFiles: [{ path: "src/app.js", content: "const value = 1;\nconsole.log(value);" }],
    changes: [{
      path: "src/app.js",
      action: "update",
      baseSha256: hash("const value = 1;\nconsole.log(value);"),
      content: "const value = 2;\nconsole.log(value);",
    }],
  });
  assert.equal(result.status, "proposal-ready");
  assert.equal(result.writesPerformed, false);
  assert.equal(result.approvalRequired, true);
  assert.equal(result.changes[0].action, "update");
  assert.match(result.changes[0].diff, /^--- a\/src\/app\.js/m);
  assert.match(result.changes[0].diff, /^\+const value = 2;/m);
});

test("permits a new file only when the snapshot has no matching path and base hash is null", () => {
  const result = validateChangeProposal({
    currentFiles: [],
    changes: [{ path: "src/new.js", action: "create", baseSha256: null, content: "export {};" }],
  });
  assert.equal(result.changes[0].before, null);
  assert.equal(result.changes[0].proposedSha256, hash("export {};"));
  assert.match(result.changes[0].diff, /^--- \/dev\/null/m);
});

test("represents deletion as a reviewable diff and never as a write", () => {
  const result = validateChangeProposal({
    currentFiles: [{ path: "src/old.js", content: "removeMe();" }],
    changes: [{ path: "src/old.js", action: "delete", baseSha256: hash("removeMe();") }],
  });
  assert.equal(result.changes[0].after, null);
  assert.match(result.changes[0].diff, /^\+\+\+ \/dev\/null/m);
  assert.equal(result.writesPerformed, false);
});

test("rejects no-op updates that would not change the project", () => {
  const content = "const value = 1;\\n";
  assert.throws(() => validateChangeProposal({
    currentFiles: [{ path: "src/app.js", content }],
    changes: [{
      path: "src/app.js",
      action: "update",
      baseSha256: hash(content),
      content,
    }],
  }), /must change the file content/);
});

test("rejects stale base hashes so proposals cannot overwrite newer user edits", () => {
  assert.throws(() => validateChangeProposal({
    currentFiles: [{ path: "src/app.js", content: "new user version" }],
    changes: [{ path: "src/app.js", action: "update", baseSha256: hash("old version"), content: "model version" }],
  }), /changed since this proposal/);
});

test("rejects path traversal, protected workspace paths and duplicate paths", () => {
  for (const path of ["../secret.txt", ".env.local", "node_modules/pkg/index.js"]) {
    assert.throws(() => validateChangeProposal({
      currentFiles: [],
      changes: [{ path, action: "create", baseSha256: null, content: "x" }],
    }));
  }
  assert.throws(() => validateChangeProposal({
    currentFiles: [],
    changes: [
      { path: "src/a.js", action: "create", baseSha256: null, content: "a" },
      { path: "src/a.js", action: "create", baseSha256: null, content: "b" },
    ],
  }), /same path more than once/);
});

test("rejects conflicting create, missing update/delete and malformed action records", () => {
  const snapshot = [{ path: "src/a.js", content: "a" }];
  assert.throws(() => validateChangeProposal({
    currentFiles: snapshot,
    changes: [{ path: "src/a.js", action: "create", baseSha256: null, content: "b" }],
  }), /already exists/);
  assert.throws(() => validateChangeProposal({
    currentFiles: snapshot,
    changes: [{ path: "src/missing.js", action: "update", baseSha256: hash("a"), content: "b" }],
  }), /missing from the project snapshot/);
  assert.throws(() => validateChangeProposal({
    currentFiles: snapshot,
    changes: [{ path: "src/a.js", action: "rename", baseSha256: hash("a"), content: "b" }],
  }), /must be create, update or delete/);
});

test("rejects invalid base hashes and content attached to deletions", () => {
  assert.throws(() => validateChangeProposal({
    currentFiles: [{ path: "src/a.js", content: "a" }],
    changes: [{ path: "src/a.js", action: "update", baseSha256: null, content: "b" }],
  }), /changed since this proposal/);
  assert.throws(() => validateChangeProposal({
    currentFiles: [{ path: "src/a.js", content: "a" }],
    changes: [{ path: "src/a.js", action: "delete", baseSha256: hash("a"), content: "" }],
  }), /cannot include replacement content/);
});

test("enforces file, change-count and total proposal byte limits", () => {
  assert.throws(() => validateChangeProposal({
    currentFiles: [],
    changes: [{ path: "src/large.js", action: "create", baseSha256: null, content: "x".repeat(1024 * 1024 + 1) }],
  }), /1 MB or smaller/);
  assert.throws(() => validateChangeProposal({
    currentFiles: [],
    changes: Array.from({ length: 51 }, (_, index) => ({
      path: "src/" + index + ".js", action: "create", baseSha256: null, content: "x",
    })),
  }), /1–50 file changes/);
  assert.throws(() => validateChangeProposal({
    currentFiles: [],
    changes: Array.from({ length: 4 }, (_, index) => ({
      path: "src/" + index + ".js", action: "create", baseSha256: null, content: "x".repeat(800 * 1024),
    })),
  }), /3 MB/);
});

test("rejects binaries, unsupported files and credential-like filenames", () => {
  for (const path of ["assets/logo.png", "certs/private.pem", "config/service-account.json", "keys/id_rsa"]) {
    assert.throws(() => validateChangeProposal({
      currentFiles: [],
      changes: [{ path, action: "create", baseSha256: null, content: "not a file payload" }],
    }), /supported source and configuration files/);
  }
});

test("rejects case-colliding paths across snapshots and proposals", () => {
  assert.throws(() => validateChangeProposal({
    currentFiles: [
      { path: "src/App.js", content: "one" },
      { path: "src/app.js", content: "two" },
    ],
    changes: [{ path: "src/other.js", action: "create", baseSha256: null, content: "x" }],
  }), /case-colliding paths/);

  assert.throws(() => validateChangeProposal({
    currentFiles: [{ path: "src/app.js", content: "one" }],
    changes: [{ path: "src/App.js", action: "create", baseSha256: null, content: "two" }],
  }), /conflicts by path case/);

  assert.throws(() => validateChangeProposal({
    currentFiles: [],
    changes: [
      { path: "src/App.js", action: "create", baseSha256: null, content: "one" },
      { path: "src/app.js", action: "create", baseSha256: null, content: "two" },
    ],
  }), /case-colliding paths/);
});

test("rejects duplicate paths in the supplied project snapshot", () => {
  assert.throws(() => validateChangeProposal({
    currentFiles: [
      { path: "src/a.js", content: "one" },
      { path: "src/a.js", content: "two" },
    ],
    changes: [{ path: "src/b.js", action: "create", baseSha256: null, content: "b" }],
  }), /duplicate paths/);
});
