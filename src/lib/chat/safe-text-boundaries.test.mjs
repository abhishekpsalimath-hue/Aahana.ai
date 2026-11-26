import test from "node:test";
import assert from "node:assert/strict";
import { takeLastWithinUtf16Limit } from "./safe-text-boundaries.mjs";

test("keeps the newest text within the requested UTF-16 budget", () => {
  assert.equal(takeLastWithinUtf16Limit("abcdef", 3), "def");
  assert.equal(takeLastWithinUtf16Limit("abcdef", 20), "abcdef");
  assert.equal(takeLastWithinUtf16Limit("abcdef", 0), "");
  assert.equal(takeLastWithinUtf16Limit("abcdef", -2), "");
});

test("does not begin inside a supplementary Unicode character", () => {
  assert.equal(takeLastWithinUtf16Limit("a🚀", 2), "🚀");
  assert.equal(takeLastWithinUtf16Limit("a🚀", 1), "");
  assert.equal(takeLastWithinUtf16Limit("🚀x", 2), "x");
  assert.equal(takeLastWithinUtf16Limit("ab🚀", 2), "🚀");
});

test("handles malformed arguments without throwing", () => {
  assert.equal(takeLastWithinUtf16Limit(null, 10), "");
  assert.equal(takeLastWithinUtf16Limit("text", Number.NaN), "");
  assert.equal(takeLastWithinUtf16Limit("text", Infinity), "");
});
