import test from "node:test";
import assert from "node:assert/strict";
import { parseVideoGenerationInput, validateVideoReferenceImage, hasCompletedVideoProviderResult, MAX_VIDEO_REFERENCE_IMAGE_BYTES } from "./video-generation.mjs";
import { buildVideoContinuityPrompt } from "./creative-director.mjs";

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
  const valid = validateVideoReferenceImage({ bytes: pngHeader(1920, 1080), imageType: "image/png", imageSize: 33 });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.dimensions, { width: 1920, height: 1080 });
  assert.equal(validateVideoReferenceImage({ bytes: pngHeader(1920, 1080), imageType: "image/jpeg", imageSize: 33 }).ok, false);
  assert.equal(validateVideoReferenceImage({ bytes: pngHeader(1920, 1080), imageType: "image/png", imageSize: 32 }).ok, false);
  assert.equal(validateVideoReferenceImage({ bytes: pngHeader(8192, 1080), imageType: "image/png", imageSize: 33 }).ok, false);
  assert.equal(validateVideoReferenceImage({ bytes: pngHeader(4096, 4096), imageType: "image/png", imageSize: 33 }).ok, true);
  assert.equal(validateVideoReferenceImage({ bytes: pngHeader(4096, 4096), imageType: "image/png", imageSize: MAX_VIDEO_REFERENCE_IMAGE_BYTES + 1 }).ok, false);
  assert.equal(validateVideoReferenceImage({ bytes: new Uint8Array(33), imageType: "image/png", imageSize: 33 }).ok, false);
});


test("builds a coherent scene plan from bounded continuity fields", () => {
  const plan = buildVideoContinuityPrompt({
    subject: "A red vintage motorcycle with a round headlamp",
    setting: "Wet city street at blue hour",
    action: "Rides slowly from left to right and comes to a stop",
    camera: "Low tracking shot that eases into a locked medium-wide frame",
    openingFrame: "Motorcycle enters from the left edge",
    closingFrame: "Motorcycle is stopped beneath a streetlight",
  });
  assert.match(plan, /Subject identity and defining visual traits: A red vintage motorcycle/);
  assert.match(plan, /Opening frame: Motorcycle enters from the left edge/);
  assert.match(plan, /closing frame should follow plausibly/);
  assert.match(plan, /do not reset, teleport, duplicate, or redesign/);
});

test("compiles multi-shot camera framing and screen-direction continuity", () => {
  const plan = buildVideoContinuityPrompt({
    subject: "A cyclist in a yellow jacket",
    shots: [
      { duration: 4, action: "Cycles from left to right along the road", camera: "Side tracking shot", framing: "Wide establishing frame", screenDirection: "Left to right", transition: "cut" },
      { duration: 5, action: "Continues forward and slows near the crossing", camera: "Tracking camera eases to a medium shot", framing: "Medium profile", screenDirection: "Left to right", transition: "match-cut" },
    ],
  });
  assert.match(plan, /Framing: Wide establishing frame/);
  assert.match(plan, /Screen direction: Left to right/);
  assert.match(plan, /axis of action, subject eyeline, geography, and camera side/);
  assert.equal(buildVideoContinuityPrompt({ shots: [{ duration: 4, action: "Moves", screenDirection: "x".repeat(81) }] }), null);
  assert.equal(buildVideoContinuityPrompt({ shots: [{ duration: 4, action: "Moves", framing: "x".repeat(81) }] }), null);
});

test("rejects malformed, unknown, and overlong continuity fields", () => {
  assert.equal(buildVideoContinuityPrompt(null), null);
  assert.equal(buildVideoContinuityPrompt([]), null);
  assert.equal(buildVideoContinuityPrompt({ unknown: "value" }), null);
  assert.equal(buildVideoContinuityPrompt({ subject: 42 }), null);
  assert.equal(buildVideoContinuityPrompt({ subject: "x".repeat(181) }), null);
  assert.equal(buildVideoContinuityPrompt({ subject: "  " }), "");
});

test("integrates optional continuity into the validated video request", () => {
  const result = parseVideoGenerationInput({
    prompt: "A red motorcycle rides through a rainy city",
    director: "cinematic",
    continuity: {
      subject: "Same red motorcycle throughout",
      action: "Moves left to right without changing speed",
      openingFrame: "Wide street establishing shot",
      closingFrame: "Close tracking shot as it stops",
    },
  });
  assert.equal(result.ok, true);
  assert.match(result.prompt, /Same red motorcycle throughout/);
  assert.match(result.prompt, /Moves left to right/);
  assert.match(result.prompt, /closing frame should follow plausibly/);
});

test("rejects invalid continuity and plans that exceed the provider prompt limit", () => {
  assert.equal(parseVideoGenerationInput({ prompt: "A scene", continuity: { subject: "x".repeat(181) } }).ok, false);
  assert.equal(parseVideoGenerationInput({
    prompt: "A".repeat(1800),
    continuity: { subject: "A stable subject", setting: "A detailed setting", action: "A carefully described action" },
  }).ok, false);
});

test("accepts only completed provider responses with a video URL", () => {
  assert.equal(hasCompletedVideoProviderResult({ state: "Completed", result: { video: "https://examples.aig.cloudflare.com/video.mp4" } }), true);
  assert.equal(hasCompletedVideoProviderResult({ state: "InProgress", result: { video: "https://examples.aig.cloudflare.com/video.mp4" } }), false);
  assert.equal(hasCompletedVideoProviderResult({ state: "Failed", result: { video: "https://examples.aig.cloudflare.com/video.mp4" } }), false);
  assert.equal(hasCompletedVideoProviderResult({ state: "Completed", result: {} }), false);
  assert.equal(hasCompletedVideoProviderResult(null), false);
  assert.equal(hasCompletedVideoProviderResult([]), false);
});


const validStoryboard = () => ({
  title: "Cinematic subject reveal",
  visualStyle: "Photorealistic, soft natural light, consistent warm color grade",
  continuity: { subjectId: "person-01", wardrobeId: "jacket-01", propIds: ["bag-01"] },
  shots: [
    { id: "shot-01", durationSeconds: 4, scene: "A quiet city street at dawn", action: "The same person walks into frame", camera: "Wide tracking shot from the left", transition: "start" },
    { id: "shot-02", durationSeconds: 5, scene: "The same street and dawn light", action: "The person pauses and looks toward the skyline", camera: "Slow medium push-in, preserving screen direction", transition: "match-cut" },
  ],
});

test("integrates a validated multi-shot storyboard and derives its total duration", () => {
  const result = parseVideoGenerationInput({ prompt: "A thoughtful cinematic city moment", storyboard: validStoryboard() });
  assert.equal(result.ok, true);
  assert.equal(result.duration, 9);
  assert.equal(result.storyboard.shots.length, 2);
  assert.match(result.prompt, /GLOBAL CONTINUITY LOCK/);
  assert.match(result.prompt, /SHOT 1 \(0–4s; 4s\)/);
  assert.match(result.prompt, /SHOT 2 \(4–9s; 5s\)/);
});

test("rejects storyboard duration conflicts with the selected provider duration", () => {
  const result = parseVideoGenerationInput({ prompt: "A cinematic scene", duration: 5, storyboard: validStoryboard() });
  assert.equal(result.ok, false);
  assert.match(result.error, /must match the total storyboard shot duration/);
});

test("rejects malformed storyboard data before provider settings are accepted", () => {
  const storyboard = validStoryboard();
  storyboard.shots[1].transition = "teleport";
  const result = parseVideoGenerationInput({ prompt: "A cinematic scene", storyboard });
  assert.equal(result.ok, false);
  assert.match(result.error, /supported transition/);
});
