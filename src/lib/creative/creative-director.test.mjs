import test from "node:test";
import assert from "node:assert/strict";
import { buildImagePrompt, buildVideoPrompt, getCreativeProviderStatus } from "./creative-director.mjs";

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
