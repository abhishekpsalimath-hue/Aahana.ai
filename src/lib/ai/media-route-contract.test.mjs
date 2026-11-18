import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const imageRoute = readFileSync(new URL("../../app/api/images/generate/route.js", import.meta.url), "utf8");
const videoRoute = readFileSync(new URL("../../app/api/videos/generate/route.js", import.meta.url), "utf8");

test("image generation authenticates before contacting the provider and bounds prompts", () => {
  const auth = imageRoute.indexOf("supabase.auth.getUser()");
  const provider = imageRoute.indexOf("await fetch(");
  assert.ok(auth >= 0 && provider > auth);
  assert.match(imageRoute, /MAX_PROMPT_LENGTH = 2048/);
  assert.match(imageRoute, /prompt.length > MAX_PROMPT_LENGTH/);
  assert.match(imageRoute, /AbortSignal.timeout\(55000\)/);
  assert.match(imageRoute, /Cache-Control": "no-store"/);
});

test("video generation has independent authentication, bounded inputs and a provider timeout", () => {
  assert.match(videoRoute, /supabase.auth.getUser\(\)/);
  assert.match(videoRoute, /validateVideoGenerationInput/);
  assert.match(videoRoute, /AbortSignal\.timeout/);
  assert.match(videoRoute, /Cache-Control/);
});

test("media endpoints never expose provider credentials in their JSON response", () => {
  for (const route of [imageRoute, videoRoute]) {
    assert.doesNotMatch(route, /JSON\.stringify\(\{[^}]*apiToken/);
    assert.doesNotMatch(route, /return NextResponse\.json\(\{[^}]*CLOUDFLARE_API_TOKEN/);
  }
});
