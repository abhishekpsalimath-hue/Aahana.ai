import test from "node:test";
import assert from "node:assert/strict";
import { createBoundedTextCollector } from "./bounded-extraction.mjs";

test("collects lines with separators while remaining within the exact character budget", () => {
  const output = createBoundedTextCollector(12);
  assert.equal(output.append("alpha"), true);
  assert.equal(output.append("beta"), true);
  assert.equal(output.text, "alpha\nbeta");
  assert.equal(output.length, 10);
  assert.equal(output.truncated, false);
});

test("truncates a line at the configured boundary and records the original size", () => {
  const output = createBoundedTextCollector(8);
  assert.equal(output.append("12345"), true);
  assert.equal(output.append("abcdef"), false);
  assert.equal(output.text, "12345\nab");
  assert.equal(output.length, 8);
  assert.equal(output.totalCharacters, 12);
  assert.equal(output.truncated, true);
});

test("does not grow after the limit is reached", () => {
  const output = createBoundedTextCollector(4);
  assert.equal(output.append("1234"), true);
  assert.equal(output.append("later"), false);
  assert.equal(output.text, "1234");
  assert.equal(output.truncated, true);
  assert.equal(output.length, 4);
});

test("rejects invalid limits", () => {
  for (const value of [0, -1, 1.5, "10", null]) {
    assert.throws(() => createBoundedTextCollector(value), TypeError);
  }
});
