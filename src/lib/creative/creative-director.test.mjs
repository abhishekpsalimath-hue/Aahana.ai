import test from "node:test";
import assert from "node:assert/strict";
import { buildImagePrompt, buildImageEditPrompt, buildVideoPrompt, getCreativeProviderStatus } from "./creative-director.mjs";

test("masterpiece image direction adds composition, lighting, and detail guidance", () => {
  const prompt = buildImagePrompt("A glass perfume bottle on black marble", "masterpiece");
  assert.match(prompt, /visual hierarchy/i);
  assert.match(prompt, /tactile material detail/i);
  assert.match(prompt, /Preserve the subject/i);
});

test("standard image direction stays minimal and unknown quality is rejected", () => {
  assert.equal(buildImagePrompt("A portrait", "standard"), "A portrait");
  assert.equal(buildImagePrompt("A portrait", "unknown"), null);
});

test("Ardhanarishvara gets a dedicated unified-form direction before standalone Shiva matching", () => {
  const prompt = buildImagePrompt("A hyper-realistic portrait of Ardhanarishvara, the divine half-male / half-female form of Shiva and Parvati", "masterpiece");
  assert.match(prompt, /one unified divine being/i);
  assert.match(prompt, /not two people standing together/i);
  assert.match(prompt, /VIEWER-LEFT HALF — Parvati/i);
  assert.match(prompt, /VIEWER-RIGHT HALF — Shiva/i);
  assert.match(prompt, /one face with two complementary halves/i);
  assert.match(prompt, /vertical division runs from the crown/i);
  assert.match(prompt, /not a generic saint/i) === false;
  assert.doesNotMatch(prompt, /Depict Lord Shiva \(Mahadev\) unmistakably/);
});

test("Ardhanarishvara prompt keeps natural portrait direction and strict vertical framing", () => {
  const prompt = buildImagePrompt("Ardhanarishvara, one combined form of Shiva and Parvati, vertical portrait", "masterpiece");
  assert.match(prompt, /realistic skin pores/i);
  assert.match(prompt, /vertical 3:4 portrait/i);
  assert.match(prompt, /avoid plastic skin/i);
  assert.match(prompt, /no duplicate features/i);
});

test("standalone Shiva still receives the original Shiva-specific direction", () => {
  const prompt = buildImagePrompt("A portrait of Lord Shiva", "masterpiece");
  assert.match(prompt, /Depict Lord Shiva \(Mahadev\) unmistakably/i);
  assert.match(prompt, /tripundra ash stripes/i);
});

test("cinematic video direction adds camera, continuity, and motion guidance", () => {
  const prompt = buildVideoPrompt("A lone astronaut walks across a red desert");
  assert.match(prompt, /motivated camera movement/i);
  assert.match(prompt, /spatial continuity/i);
  assert.match(prompt, /flicker/i);
});

test("video director presets are validated and none preserves the original prompt", () => {
  assert.equal(buildVideoPrompt("A scene", "none"), "A scene");
  assert.equal(buildVideoPrompt("A scene", "unknown"), null);
  assert.match(buildVideoPrompt("A bottle", "commercial"), /premium/i);
});

test("provider registry reports configuration without exposing credentials", () => {
  const status = getCreativeProviderStatus({
    CLOUDFLARE_ACCOUNT_ID: "account",
    CLOUDFLARE_API_TOKEN: "secret",
    ELEVENLABS_API_KEY: "voice-secret",
  });
  assert.equal(status.find((item) => item.id === "cloudflare").configured, true);
  assert.equal(status.find((item) => item.id === "elevenlabs").configured, true);
  assert.equal(status.find((item) => item.id === "higgsfield").configured, false);
  assert.equal(JSON.stringify(status).includes("secret"), false);
});

test("reference image edit prompt preserves original sacred subject identity", () => {
  const prompt = buildImageEditPrompt(
    "Generate Lord Shiva with a crescent moon, Ganga, tripundra and trident",
    "Make the background cinematic"
  );
  assert.match(prompt, /Original image brief: Generate Lord Shiva/i);
  assert.match(prompt, /Requested refinement: Make the background cinematic/i);
  assert.match(prompt, /Preserve the exact main subject, identity, face, anatomy, pose/i);
  assert.match(prompt, /Lord Shiva \(Mahadev\) unmistakably/i);
});

test("reference image edit prompt rejects empty instructions", () => {
  assert.equal(buildImageEditPrompt("A portrait", " "), null);
});

test("masterpiece direction protects explicit subject and composition constraints for every image", () => {
  const prompt = buildImagePrompt("A red bicycle, exactly three yellow balloons, subject on the left, in Kannada", "masterpiece");
  assert.match(prompt, /Treat the user prompt as a specification/i);
  assert.match(prompt, /exact requested subject identity/i);
  assert.match(prompt, /number of subjects and objects/i);
  assert.match(prompt, /left\/right placement/i);
  assert.match(prompt, /language it was written in/i);
  assert.match(prompt, /never invent text/i);
});
