import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../../app/api/videos/generate/route.js", import.meta.url), "utf8");
const downloadRoute = readFileSync(new URL("../../app/api/videos/download/route.js", import.meta.url), "utf8");
const experienceLab = readFileSync(new URL("../../app/experience-lab/page.jsx", import.meta.url), "utf8");
const experienceLabStyles = readFileSync(new URL("../../app/experience-lab/experience-lab.css", import.meta.url), "utf8");

test("video endpoint authenticates before provider calls and bounds execution", () => {
  const auth = route.indexOf("supabase.auth.getUser()");
  const provider = route.indexOf("await fetch(");
  assert.ok(auth >= 0 && provider > auth);
  assert.match(route, /validateVideoGenerationInput/);
  assert.match(route, /AbortSignal.any\(\[request.signal, AbortSignal.timeout\(165000\)\]\)/);
  assert.match(route, /request.signal.aborted/);
  assert.match(route, /status: 499/);
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
  assert.match(downloadRoute, /AbortSignal.any\(\[request.signal, AbortSignal.timeout\(150000\)\]\)/);
  assert.match(downloadRoute, /request.signal.aborted/);
  assert.match(downloadRoute, /status: 499/);
});

test("Experience Lab exposes video creation, playback and download without bypassing cancellation", () => {
  assert.match(experienceLab, /isVideoGenerationRequest/);
  assert.match(experienceLab, /api\/videos\/generate/);
  assert.match(experienceLab, /generatedVideo/);
  assert.match(experienceLab, /api\/videos\/download/);
  assert.match(experienceLab, /signal: controller\.signal/);
  assert.match(experienceLab, /stopGeneration/);
  assert.match(experienceLabStyles, /\.lab-generated-video/);
});

test("video generation stops processing a provider response after caller cancellation", () => {
  assert.match(route, /const result = await response\.json\(\)\.catch\(\(\) => null\);\s*if \(request\.signal\.aborted\) return new Response\(null, \{ status: 499 \}\);/);
});


test("video generation distinguishes caller cancellation from the provider deadline", () => {
  assert.match(route, /providerSignal = AbortSignal\.any\(\[request\.signal, AbortSignal\.timeout\(165000\)\]\)/);
  assert.match(route, /if \(request\.signal\.aborted\) return new Response\(null, \{ status: 499 \}\);\s*if \(providerSignal\.aborted\)/);
  assert.match(route, /status: 504/);
  assert.match(route, /status: 503/);
  assert.match(route, /providerSignal\?\.aborted/);
});
