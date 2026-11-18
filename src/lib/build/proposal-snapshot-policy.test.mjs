import test from "node:test";
import assert from "node:assert/strict";
import { toProposalSnapshotPath } from "./proposal-snapshot-policy.mjs";

test("preserves valid relative source paths exactly", () => {
  assert.equal(toProposalSnapshotPath("src/components/Button.tsx"), "src/components/Button.tsx");
  assert.equal(toProposalSnapshotPath("README.md"), "README.md");
});

test("leaves unsupported documents and media outside code snapshots", () => {
  assert.equal(toProposalSnapshotPath("design/mockup.png"), null);
  assert.equal(toProposalSnapshotPath("brief.pdf"), null);
});

test("rejects absolute, Windows, traversal and protected paths instead of normalising them", () => {
  for (const filename of [
    "/src/app.js",
    "\\src\\app.js",
    "../outside.js",
    "src/../outside.js",
    ".env.local",
    "node_modules/pkg/index.js",
    ".git/config",
  ]) {
    assert.throws(() => toProposalSnapshotPath(filename), undefined, filename);
  }
});

test("rejects empty and non-string filenames", () => {
  assert.throws(() => toProposalSnapshotPath(""));
  assert.throws(() => toProposalSnapshotPath(null));
});
