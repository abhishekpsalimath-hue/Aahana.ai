import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("./page.jsx", import.meta.url), "utf8");

test("switching Experience Lab modes aborts and invalidates an in-flight assistant request", () => {
  const switchMode = page.slice(page.indexOf("  function switchMode"), page.indexOf("  function stopGeneration"));
  assert.match(switchMode, /controller\.abort\(\);/);
  assert.match(switchMode, /activeRequest\.current = null;/);
  assert.match(switchMode, /setMode\(nextMode\);/);
  assert.match(page, /onClick=\{\(\) => switchMode\(item\.id\)\}/);
  assert.match(page, /onClick=\{\(\) => \{ switchMode\("chat"\); startNewSession\\(true\\);/);
});

test("mode switching retains the existing Learn-to-learn API mapping", () => {
  assert.match(page, /learn: "learn"/);
  assert.match(page, /\{ id: "learn", label: "Learn"/);
});

test("stopped requests keep the existing response-stopped feedback", () => {
  assert.match(page, /content: "Response stopped\."/);
});

test("Home starts a fresh session after cancelling an in-flight response", () => {
  const startNewSession = page.slice(page.indexOf("  function startNewSession"), page.indexOf("\n  return <main"));
  assert.match(startNewSession, /function startNewSession\(force = false\)/);
  assert.match(startNewSession, /if \(busy && !force\) return;/);
  assert.match(page, /switchMode\("chat"\); startNewSession\(true\); setActivePanel\("tools"\)/);
  assert.match(startNewSession, /setThread\(\[\]\);[\s\S]*setConversationId\(null\);/);
});
