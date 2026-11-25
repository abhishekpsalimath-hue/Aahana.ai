import test from "node:test";
import assert from "node:assert/strict";
import { parseVideoGenerationInput, validateVideoReferenceImage, MAX_VIDEO_REFERENCE_IMAGE_BYTES } from "./video-generation.mjs";

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

function pngHeader(width, height) {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

test("validates video reference image signatures and safe dimensions", () => {
  const valid = validateVideoReferenceImage({ bytes: pngHeader(1920, 1080), imageType: "image/png", imageSize: 1000 });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.dimensions, { width: 1920, height: 1080 });
  assert.equal(validateVideoReferenceImage({ bytes: pngHeader(1920, 1080), imageType: "image/jpeg", imageSize: 1000 }).ok, false);
  assert.equal(validateVideoReferenceImage({ bytes: pngHeader(1920, 1080), imageType: "image/png", imageSize: 999 }).ok, false);
  assert.equal(validateVideoReferenceImage({ bytes: pngHeader(8192, 1080), imageType: "image/png", imageSize: 1000 }).ok, false);
  assert.equal(validateVideoReferenceImage({ bytes: pngHeader(4096, 4096), imageType: "image/png", imageSize: 1000 }).ok, true);
  assert.equal(validateVideoReferenceImage({ bytes: pngHeader(4096, 4096), imageType: "image/png", imageSize: MAX_VIDEO_REFERENCE_IMAGE_BYTES + 1 }).ok, false);
  assert.equal(validateVideoReferenceImage({ bytes: new Uint8Array(33), imageType: "image/png", imageSize: 1000 }).ok, false);
});
