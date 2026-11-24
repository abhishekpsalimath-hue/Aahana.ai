import test from "node:test";
import assert from "node:assert/strict";
import { limitDocumentText } from "./document-text-limits.mjs";

test("preserves complete short document text", () => {
  const result = limitDocumentText("  First page text\nSecond page text  ", 100);
  assert.equal(result.text, "First page text\nSecond page text");
  assert.equal(result.truncated, false);
  assert.equal(result.extractedCharacters, result.text.length);
});

test("puts an explicit truncation notice before capped document text", () => {
  const result = limitDocumentText("A".repeat(200), 100);
  assert.equal(result.truncated, true);
  assert.ok(result.text.length <= 100);
  assert.match(result.text, /^\[This file was longer than Aahana's document-analysis limit/);
  assert.equal(result.extractedCharacters, 200);
});

test("normalizes null bytes and non-string inputs safely", () => {
  assert.equal(limitDocumentText("A\u0000B", 100).text, "AB");
  assert.deepEqual(limitDocumentText(null, 100), { text: "", truncated: false, extractedCharacters: 0 });
});
