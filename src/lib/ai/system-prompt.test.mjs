import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildAahanaSystemPrompt } from "./system-prompt.mjs";

test("shared Aahana prompt preserves the solve-mode instructions used by chat", () => {
  const prompt = buildAahanaSystemPrompt("solve");
  assert.match(prompt, /You are Aahana/);
  assert.match(prompt, /Do not confuse confidence with correctness/);
  assert.match(prompt, /Support multilingual conversations/);
  assert.match(prompt, /The selected mode is: solve/);
});

test("shared Aahana prompt keeps build-specific instructions scoped to Build Mode", () => {
  assert.doesNotMatch(buildAahanaSystemPrompt("solve"), /BUILD MODE:/);
  assert.match(buildAahanaSystemPrompt("build"), /BUILD MODE:/);
});

test("isolated benchmark runner passes Node syntax validation", () => {
  const runnerPath = fileURLToPath(new URL("../../../scripts/run-assistant-evaluation.mjs", import.meta.url));
  execFileSync(process.execPath, ["--check", runnerPath], { stdio: "pipe" });
});
