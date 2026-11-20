import test from "node:test";
import assert from "node:assert/strict";
import { parseVideoGenerationInput } from "./video-generation.mjs";

test("defaults to a five-second 480p widescreen video", () => {
  assert.deepEqual(parseVideoGenerationInput({ prompt: "A calm ocean at sunrise" }), {
    ok: true, prompt: "A calm ocean at sunrise", duration: 5, aspectRatio: "16:9", resolution: "480p",
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
  for (const duration of [0, 6, 10, "5", null]) {
    assert.equal(parseVideoGenerationInput({ prompt: "A scene", duration }).ok, false);
  }
  assert.equal(parseVideoGenerationInput({ prompt: "A scene", aspectRatio: "21:9" }).ok, false);
  assert.equal(parseVideoGenerationInput({ prompt: "A scene", resolution: "1080p" }).ok, false);
});

test("trims a valid prompt and accepts the maximum initial duration", () => {
  const result = parseVideoGenerationInput({ prompt: "  A cinematic city  ", duration: 5, resolution: "720p" });
  assert.equal(result.ok, true);
  assert.equal(result.prompt, "A cinematic city");
  assert.equal(result.duration, 5);
  assert.equal(result.resolution, "720p");
});
