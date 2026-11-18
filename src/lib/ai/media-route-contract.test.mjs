import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../../app/api/videos/generate/route.js", import.meta.url), "utf8");
const downloadRoute = readFileSync(new URL("../../app/api/videos/download/route.js", import.meta.url), "utf8");
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

test("video endpoint extracts the signed URL from supported Cloudflare response envelopes", () => {
  assert.match(route, /payload\?\.result\?\.result\?\.video/);
  assert.match(route, /payload\?\.result\?\.video/);
  assert.match(route, /payload\?\.video/);
});

test("video downloads require authentication, a trusted host and block redirects", () => {
  const auth = downloadRoute.indexOf("supabase.auth.getUser()");
  const provider = downloadRoute.indexOf("await fetch(");
  assert.ok(auth >= 0 && provider > auth);
  assert.match(downloadRoute, /isTrustedGeneratedVideoUrl/);
  assert.match(downloadRoute, /redirect:\s*"error"/);
  assert.match(downloadRoute, /Content-Disposition/);
  assert.match(downloadRoute, /AbortSignal.timeout/);
});

test("assistant exposes video creation, quality, duration and download controls", () => {
  assert.match(workspace, /isVideoGenerationRequest/);
  assert.match(workspace, /Generate video/);
  assert.match(workspace, /value="fhd"/);
  assert.match(workspace, /Video aspect ratio/);
  assert.match(route, /aspect_ratio:\s*input\.aspectRatio/);
  assert.match(workspace, /videoDuration/);
  assert.match(workspace, /generatedVideo/);
  assert.match(workspace, /api\/videos\/download/);
});

test("Aahana typography uses the distinctive display and interface font pair", () => {
  assert.match(styles, /family=Outfit/);
  assert.match(styles, /Space\+Grotesk/);
  assert.doesNotMatch(styles, /DM\s+Sans|Manrope/);
});
