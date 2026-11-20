import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./assistant-workspace.jsx", import.meta.url), "utf8");

test("mode tabs expose roving focus and keyboard navigation", () => {
  assert.match(source, /tabIndex=\{mode === item\.id \? 0 : -1\}/);
  assert.match(source, /onKeyDown=\{\(event\) => handleModeTabKeyDown\(event, index\)\}/);
  assert.match(source, /event\.key === "ArrowRight"/);
  assert.match(source, /event\.key === "ArrowLeft"/);
  assert.match(source, /event\.key === "Home"/);
  assert.match(source, /event\.key === "End"/);
  assert.match(source, /modeTabRefs\.current\[nextMode\.id\]\?\.focus\(\)/);
});
