import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../../app/api/videos/generate/route.js", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../../app/assistant-workspace.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

test("video endpoint authenticates before provider calls and bounds execution", () => {
  const auth = route.indexOf("supabase.auth.getUser()");
  const provider = route.indexOf("await fetch(");
  assert.ok(auth >= 0 && provider > auth);
  assert.match(route, /validateVideoGenerationInput/);
  assert.match(route, /AbortSignal.timeout\(165000\)/);
  assert.match(route, /isTrustedGeneratedVideoUrl/);
  assert.match(route, /Cache-Control/);
  assert.match(route, /black-forest-labs\/flux-3-video/);
});

test("assistant exposes video creation, quality and duration controls", () => {
  assert.match(workspace, /isVideoGenerationRequest/);
  assert.match(workspace, /Generate video/);
  assert.match(workspace, /value="fhd"/);
  assert.match(workspace, /videoDuration/);
  assert.match(workspace, /generatedVideo/);
});

test("Aahana typography uses the distinctive display and interface font pair", () => {
  assert.match(styles, /family=Outfit/);
  assert.match(styles, /Space\+Grotesk/);
  assert.doesNotMatch(styles, /DM\s+Sans|Manrope/);
});
