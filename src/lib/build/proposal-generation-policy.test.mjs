import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { prepareValidatedProposal } from "./proposal-generation-policy.mjs";

const hash = (value) => createHash("sha256").update(value, "utf8").digest("hex");

test("validates an update only when the complete source was shown to the model", () => {
  const currentFiles = [{ path: "src/app.js", content: "export const value = 1;" }];
  const result = prepareValidatedProposal({
    currentFiles,
    modelVisiblePaths: new Set(["src/app.js"]),
    draft: {
      type: "aahana_code_change_proposal_v1",
      summary: "Update the app value.",
      changes: [{ path: "src/app.js", action: "update", content: "export const value = 2;" }],
    },
  });
  assert.equal(result.status, "proposal-ready");
  assert.equal(result.writesPerformed, false);
  assert.equal(result.summary, "Update the app value.");
  assert.equal(result.changes[0].baseSha256, hash("export const value = 1;"));
});

test("rejects updates and deletes to files omitted from model context", () => {
  const currentFiles = [{ path: "src/hidden.js", content: "doNotTouch();" }];
  for (const action of ["update", "delete"]) {
    assert.throws(() => prepareValidatedProposal({
      currentFiles,
      modelVisiblePaths: new Set(),
      draft: {
        type: "aahana_code_change_proposal_v1",
        summary: "Try to modify hidden source.",
        changes: [action === "update"
          ? { path: "src/hidden.js", action, content: "replacement();" }
          : { path: "src/hidden.js", action }],
      },
    }), /complete source was not included/);
  }
});

test("permits a new file without exposing an unrelated existing file", () => {
  const result = prepareValidatedProposal({
    currentFiles: [{ path: "src/private.js", content: "untouched();" }],
    modelVisiblePaths: new Set(),
    draft: {
      type: "aahana_code_change_proposal_v1",
      summary: "Add a separate helper.",
      changes: [{ path: "src/helper.js", action: "create", content: "export {};" }],
    },
  });
  assert.equal(result.changes[0].action, "create");
  assert.equal(result.changes[0].baseSha256, null);
});

test("rejects missing model context and malformed draft envelopes", () => {
  assert.throws(() => prepareValidatedProposal({
    currentFiles: [],
    modelVisiblePaths: [],
    draft: {},
  }), /path set is required/);
  assert.throws(() => prepareValidatedProposal({
    currentFiles: [],
    modelVisiblePaths: new Set(),
    draft: { type: "wrong", summary: "x", changes: [] },
  }), /valid Aahana code change proposal/);
});
