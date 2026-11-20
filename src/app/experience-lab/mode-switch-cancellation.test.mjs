import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("./page.jsx", import.meta.url), "utf8");

test("switching Experience Lab modes aborts an in-flight assistant request", () => {
  assert.match(page, /function switchMode\(nextMode\)\s*\{\s*if \(activeRequest\.current\) activeRequest\.current\.abort\(\);\s*setMode\(nextMode\);/);
  assert.match(page, /onClick=\{\(\) => switchMode\(item\.id\)\}/);
  assert.match(page, /onClick=\{\(\) => \{ switchMode\("chat"\); startNewSession\(\);/);
});

test("mode switching retains the existing Learn-to-learn API mapping", () => {
  assert.match(page, /learn: "learn"/);
  assert.match(page, /\{ id: "learn", label: "Learn"/);
});

test("stopped requests keep the existing response-stopped feedback", () => {
  assert.match(page, /if \(error\.name === "AbortError"\)/);
  assert.match(page, /content: "Response stopped\."/);
});
