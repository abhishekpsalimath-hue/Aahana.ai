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

test("benchmark dry run validates all 100 cases without credentials or network", () => {
  const runnerPath = fileURLToPath(new URL("../../../scripts/run-assistant-evaluation.mjs", import.meta.url));
  const output = execFileSync(process.execPath, [runnerPath, "--dry-run"], {
    encoding: "utf8",
    env: { ...process.env, AAHANA_AI_PROVIDER: "groq", GROQ_API_KEY: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const report = JSON.parse(output);
  assert.equal(report.dryRun, true);
  assert.equal(report.cases, 100);
  assert.equal(report.casesPlanned, 100);
  assert.equal(report.availableCases, 100);
  assert.equal(report.categories.length, 10);
  assert.equal(report.networkRequests, 0);
  assert.equal(report.databaseWrites, 0);
  assert.equal(report.requiresApiKey, false);
  assert.equal(report.dimensions.length, 5);
});
