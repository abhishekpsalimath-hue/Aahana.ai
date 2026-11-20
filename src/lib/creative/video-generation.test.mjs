import test from "node:test";
import assert from "node:assert/strict";
import { parseVideoGenerationInput } from "./video-generation.mjs";

test("defaults to a five-second 480p widescreen video", () => {
  assert.deepEqual(parseVideoGenerationInput({ prompt: "A calm ocean at sunrise" }), {
    ok: true, prompt: "A calm ocean at sunrise\n\nCinematic direction: define a clear opening composition, one readable subject action, motivated camera movement, natural physical motion, coherent spatial continuity, controlled focus, and a visually satisfying final frame. Keep motion smooth and avoid morphing, flicker, jitter, object duplication, and sudden scene changes.", duration: 5, aspectRatio: "16:9", resolution: "480p", director: "cinematic",
  });
});

test("accepts supported portrait, square, and landscape ratios", () => {
  for (const aspectRatio of ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"]) {
    assert.equal(parseVideoGenerationInput({ prompt: "A scene", aspectRatio }).ok, true);
  }
});

test("rejects empty, overlong, and unsupported video prompts or settings", () => {
  assert.equal(parseVideoGenerationInput({ prompt: " " }).ok, false);
  assert.equal(parseVideoGenerationInput({ prompt: "x".repeat(2001) }).ok, false);
  for (const duration of [0, 16, 20, "5", null]) {
    assert.equal(parseVideoGenerationInput({ prompt: "A scene", duration }).ok, false);
  }
  assert.equal(parseVideoGenerationInput({ prompt: "A scene", aspectRatio: "21:9" }).ok, false);
  assert.equal(parseVideoGenerationInput({ prompt: "A scene", resolution: "1080p" }).ok, false);
});

test("trims a valid prompt and accepts the documented maximum duration", () => {
  const result = parseVideoGenerationInput({ prompt: "  A cinematic city  ", duration: 15, resolution: "720p" });
  assert.equal(result.ok, true);
  assert.match(result.prompt, /A cinematic city/);
  assert.match(result.prompt, /motivated camera movement/);
  assert.equal(result.duration, 15);
  assert.equal(result.resolution, "720p");
  assert.equal(result.director, "cinematic");
});

test("supports validated director presets and can preserve a raw prompt", () => {
  assert.equal(parseVideoGenerationInput({ prompt: "A scene", director: "unknown" }).ok, false);
  const raw = parseVideoGenerationInput({ prompt: "A scene", director: "none" });
  assert.equal(raw.ok, true);
  assert.equal(raw.prompt, "A scene");
});

test("accepts intermediate durations supported by the provider", () => {
  for (const duration of [1, 3, 5, 10, 15]) {
    assert.equal(parseVideoGenerationInput({ prompt: "A scene", duration }).ok, true);
  }
});
