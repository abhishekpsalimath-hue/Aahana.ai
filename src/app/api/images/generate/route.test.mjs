import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("./route.js", import.meta.url), "utf8");

test("image generation authenticates before optional prompt refinement and provider execution", () => {
  const auth = route.indexOf("supabase.auth.getUser()");
  const refine = route.indexOf("await refineImagePrompt(prompt)");
  const provider = route.indexOf("await fetch(", route.indexOf("const { prompt: finalPrompt"));
  assert.ok(auth >= 0 && refine > auth && provider > refine);
});

test("image generation uses a bounded Groq prompt compiler with original-prompt fallback", () => {
  assert.match(route, /AbortSignal.timeout\(3500\)/);
  assert.match(route, /selectCompiledImagePrompt\(candidate, originalPrompt\)/);
  assert.match(route, /return \{ prompt: originalPrompt, refined: false \}/);
  assert.match(route, /prompt: finalPrompt, steps: 8/);
  assert.match(route, /promptRefined: refined/);
});

test("image generation requires prompt and generated-image safety checks", () => {
  assert.match(route, /AAHANA_IMAGE_SAFETY_ENABLED !== "true"/);
  assert.match(route, /await moderateImagePrompt\(accountId, apiToken, prompt\)/);
  assert.match(route, /await moderateGeneratedImage\(accountId, apiToken, imageDataUrl\)/);
  assert.match(route, /safetyChecked: true/);
});

test("image generation uses the built-in Workers AI model endpoint", () => {
  assert.ok(route.includes("/ai/run/${MODEL}"));
  assert.ok(route.includes("body: JSON.stringify({ prompt: finalPrompt, steps: 8 })"));
});

test("image safety checks use the requested safety model and generation uses the image model", () => {
  const safetyStart = route.indexOf("async function runSafetyModel");
  const safetyEnd = route.indexOf("async function moderateImagePrompt");
  const safetyRunner = route.slice(safetyStart, safetyEnd);
  assert.ok(safetyRunner.includes("/ai/run/${model}"));
  assert.ok(!safetyRunner.includes("/ai/run/${MODEL}"));

  const generationStart = route.indexOf("const { prompt: finalPrompt");
  const generationEnd = route.indexOf("const result = await response.json()", generationStart);
  const generationRequest = route.slice(generationStart, generationEnd);
  assert.ok(generationRequest.includes("/ai/run/${MODEL}"));
  assert.ok(!generationRequest.includes("/ai/run/${model}"));
});

test("image safety checks use the built-in Workers AI model endpoint", () => {
  assert.ok(route.includes("/ai/run/${model}"));
  assert.ok(route.includes("body: JSON.stringify(input)"));
});
