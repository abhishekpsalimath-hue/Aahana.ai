import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("./route.js", import.meta.url), "utf8");

test("image processing authenticates and checks feature gates before provider calls", () => {
  const auth = route.indexOf("supabase.auth.getUser()");
  const gate = route.indexOf("AAHANA_IMAGE_WORKFLOWS_ENABLED");
  const provider = route.indexOf("async function runCloudflare");
  assert.ok(auth >= 0 && gate > auth && provider >= 0);
  assert.match(route, /AAHANA_IMAGE_SAFETY_ENABLED !== "true"/);
});

test("image processing validates uploads and prompts before model execution", () => {
  assert.match(route, /parseImageDataUrl\(body\?\.imageDataUrl\)/);
  assert.match(route, /isAllowedPrompt\(prompt\)/);
  assert.match(route, /Choose a PNG, JPEG or WebP image up to 2 MB/);
});

test("image processing checks source and prompt before edit or upscale, then checks output", () => {
  assert.match(route, /const checks = \[moderateImage\(accountId, apiToken, inputDataUrl\)\]/);
  assert.match(route, /checks\.push\(moderatePrompt\(accountId, apiToken, prompt\)\)/);
  assert.match(route, /await Promise\.all\(checks\)/);
  const outputSafety = route.lastIndexOf("await moderateImage(accountId, apiToken, imageDataUrl)");
  const response = route.indexOf("return NextResponse.json(\n      { imageDataUrl");
  assert.ok(outputSafety >= 0 && response > outputSafety);
});

test("image editing and 4K enhancement use separate provider models", () => {
  assert.match(route, /black-forest-labs\/flux-3-image-klein/);
  assert.match(route, /topaz\/gigapixel-high-fidelity-3/);
  assert.match(route, /output_width: 3840/);
  assert.match(route, /originalPreserved: true/);
});

test("image processing uses the documented Cloudflare AI run envelope", () => {
  assert.ok(route.includes("/ai/run`"));
  assert.ok(route.includes("JSON.stringify({ model, input })"));
  assert.ok(!route.includes("/ai/run/${model}"));
});
