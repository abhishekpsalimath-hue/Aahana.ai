import test from "node:test";
import assert from "node:assert/strict";
import { validateSourceProposal } from "./source-proposal.mjs";

const context = { fileName: "src/app.js", version: "a".repeat(64) };
const valid = {
  fileName: context.fileName,
  baseVersion: context.version,
  summary: "Fix the null check.",
  updatedContent: "export const value = 1;\n",
};

test("accepts a proposal only for the exact open file and version", () => {
  assert.deepEqual(validateSourceProposal(JSON.stringify(valid), context), {
    ...context, summary: valid.summary, updatedContent: valid.updatedContent,
    sizeBytes: new TextEncoder().encode(valid.updatedContent).byteLength,
  });
});

test("accepts a complete JSON code fence but rejects malformed output", () => {
  assert.equal(validateSourceProposal("```json\n" + JSON.stringify(valid) + "\n```", context).updatedContent, valid.updatedContent);
  assert.throws(() => validateSourceProposal("Here is the code: " + JSON.stringify(valid), context), /valid JSON/);
});

test("rejects proposals for another file or stale source version", () => {
  assert.throws(() => validateSourceProposal(JSON.stringify({ ...valid, fileName: "other.js" }), context), /did not match/);
  assert.throws(() => validateSourceProposal(JSON.stringify({ ...valid, baseVersion: "b".repeat(64) }), context), /did not match/);
});

test("rejects empty, oversized, binary and malformed proposals", () => {
  assert.throws(() => validateSourceProposal(JSON.stringify({ ...valid, updatedContent: "" }), context), /1 byte/);
  assert.throws(() => validateSourceProposal(JSON.stringify({ ...valid, updatedContent: "x".repeat(1024 * 1024 + 1) }), context), /1 byte/);
  assert.throws(() => validateSourceProposal(JSON.stringify({ ...valid, updatedContent: "bad\u0000source" }), context), /1 byte/);
  assert.throws(() => validateSourceProposal(JSON.stringify({ ...valid, summary: " " }), context), /did not match/);
  assert.throws(() => validateSourceProposal("x".repeat(2 * 1024 * 1024 + 1), context), /oversized/);
});
