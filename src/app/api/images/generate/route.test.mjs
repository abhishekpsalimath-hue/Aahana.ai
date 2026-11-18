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

test("image generation uses the documented Cloudflare model and input envelope", () => {
  assert.match(route, /client\\.v4\\/accounts\\/.*\\/ai\\/run`/);
  assert.match(route, /JSON\\.stringify\\(\\{ model: MODEL, input: \\{ prompt: finalPrompt, steps: 8 \\} \\}\\)/);
});
