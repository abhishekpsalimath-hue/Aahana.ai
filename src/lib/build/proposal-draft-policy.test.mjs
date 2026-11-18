import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { prepareChangeProposalDraft } from "./proposal-draft-policy.mjs";

const hash = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const snapshot = [
  { path: "src/app.js", content: "export const oldValue = 1;\n" },
  { path: "README.md", content: "# Project\n" },
];
const draft = (changes) => ({
  type: "aahana_code_change_proposal_v1",
  summary: "Improve the application entry point.",
  changes,
});

test("server derives the base hash for updates and ignores model-supplied hashes", () => {
  const result = prepareChangeProposalDraft({
    currentFiles: snapshot,
    draft: draft([{ path: "src/app.js", action: "update", content: "export const newValue = 2;\n" }]),
  });
  assert.equal(result.changes[0].baseSha256, hash(snapshot[0].content));
  assert.equal(result.changes[0].content, "export const newValue = 2;\n");
});

test("creates new files with a server-defined null base hash", () => {
  const result = prepareChangeProposalDraft({
    currentFiles: snapshot,
    draft: draft([{ path: "src/new-file.ts", action: "create", content: "export {};" }]),
  });
  assert.equal(result.changes[0].baseSha256, null);
});

test("deletes existing files without replacement content", () => {
  const result = prepareChangeProposalDraft({
    currentFiles: snapshot,
    draft: draft([{ path: "README.md", action: "delete" }]),
  });
  assert.equal(result.changes[0].baseSha256, hash(snapshot[1].content));
  assert.equal(Object.hasOwn(result.changes[0], "content"), false);
});

test("rejects create/update/delete operations inconsistent with the snapshot", () => {
  const cases = [
    [{ path: "src/app.js", action: "create", content: "x" }],
    [{ path: "missing.js", action: "update", content: "x" }],
    [{ path: "missing.js", action: "delete" }],
    [{ path: "src/app.js", action: "delete", content: "" }],
  ];
  for (const changes of cases) {
    assert.throws(() => prepareChangeProposalDraft({ currentFiles: snapshot, draft: draft(changes) }));
  }
});

test("rejects unknown fields, duplicate paths, unsafe paths and unsupported extensions", () => {
  const cases = [
    [{ path: "src/app.js", action: "update", content: "x", baseSha256: "forged" }],
    [
      { path: "src/app.js", action: "update", content: "x" },
      { path: "src/app.js", action: "update", content: "y" },
    ],
    [{ path: "../outside.js", action: "create", content: "x" }],
    [{ path: "assets/image.png", action: "create", content: "x" }],
  ];
  for (const changes of cases) {
    assert.throws(() => prepareChangeProposalDraft({ currentFiles: snapshot, draft: draft(changes) }));
  }
});

test("rejects malformed proposal envelopes and malformed current snapshots", () => {
  assert.throws(() => prepareChangeProposalDraft({ currentFiles: snapshot, draft: { ...draft([]), type: "other" } }));
  assert.throws(() => prepareChangeProposalDraft({ currentFiles: snapshot, draft: draft([]) }));
  assert.throws(() => prepareChangeProposalDraft({ currentFiles: [{ path: "src/app.js", content: 4 }], draft: draft([{ path: "new.js", action: "create", content: "x" }]) }));
  assert.throws(() => prepareChangeProposalDraft({ currentFiles: [...snapshot, ...snapshot], draft: draft([{ path: "new.js", action: "create", content: "x" }]) }));
});

test("trims the summary and rejects empty or oversized summaries", () => {
  const result = prepareChangeProposalDraft({
    currentFiles: snapshot,
    draft: { ...draft([{ path: "src/new.js", action: "create", content: "x" }]), summary: "  Small improvement  " },
  });
  assert.equal(result.summary, "Small improvement");
  assert.throws(() => prepareChangeProposalDraft({
    currentFiles: snapshot,
    draft: { ...draft([{ path: "src/new.js", action: "create", content: "x" }]), summary: " " },
  }));
  assert.throws(() => prepareChangeProposalDraft({
    currentFiles: snapshot,
    draft: { ...draft([{ path: "src/new.js", action: "create", content: "x" }]), summary: "x".repeat(501) },
  }));
});
