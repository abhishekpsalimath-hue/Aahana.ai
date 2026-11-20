import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("./page.jsx", import.meta.url), "utf8");
const previewFlow = page.slice(page.indexOf("  async function previewFlow"), page.indexOf("  function stopGeneration"));
const switchMode = page.slice(page.indexOf("  function switchMode"), page.indexOf("  function stopGeneration"));

test("chat stream writes are guarded by the request that owns the active controller", () => {
  assert.match(previewFlow, /if \(activeRequest\.current !== controller\) return;/);
  assert.match(previewFlow, /if \(activeRequest\.current === controller\) \{\s*activeRequest\.current = null;\s*setBusy\(false\);\s*\}/);
});

test("a stale request cannot overwrite a newer response or publish its error", () => {
  assert.match(previewFlow, /catch \(error\) \{\s*if \(activeRequest\.current !== controller\) return;/);
  assert.match(previewFlow, /while \(true\) \{\s*const \{ value, done \} = await reader\.read\(\);\s*if \(activeRequest\.current !== controller\) return;/);
});

test("mode switching invalidates the old controller and closes its pending assistant turn", () => {
  assert.match(switchMode, /controller\.abort\(\);\s*activeRequest\.current = null;/);
  assert.match(switchMode, /setBusy\(false\);/);
  assert.match(switchMode, /content: "Response stopped\."/);
});
