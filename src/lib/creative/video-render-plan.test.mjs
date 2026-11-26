import test from "node:test";
import assert from "node:assert/strict";
import { compileVideoRenderPlan, VIDEO_EXPORT_LIMITS } from "./video-render-plan.mjs";

const project = () => ({
  id: "project-001",
  version: 3,
  tracks: [
    { id: "track-video", type: "video", name: "Picture", clips: [
      { id: "clip-b", assetId: "asset-b", start: 5, duration: 4, sourceStart: 1, sourceDuration: 4, volume: 0.6,
        keyframes: [{ at: 2, property: "opacity", value: 0.5, easing: "ease-in" }],
        transitionIn: "crossfade", transitionInDuration: 1 },
      { id: "clip-a", assetId: "asset-a", start: 0, duration: 5, volume: 0.8 },
    ] },
    { id: "track-audio", type: "audio", name: "Voiceover", muted: false, clips: [
      { id: "clip-voice", assetId: "asset-voice", start: 1, duration: 8, volume: 0.75 },
    ] },
  ],
});

test("compiles a stable multi-track EDL without claiming to render media", () => {
  const plan = compileVideoRenderPlan(project());
  assert.equal(plan.schema, "aahana.video-edl.v1");
  assert.equal(plan.projectId, "project-001");
  assert.equal(plan.projectVersion, 3);
  assert.equal(plan.status, "planned");
  assert.equal(plan.execution, "not-rendered");
  assert.equal(plan.durationSeconds, 9);
  assert.equal(plan.frameCount, 270);
  assert.deepEqual(plan.assets, ["asset-a", "asset-b", "asset-voice"]);
  assert.deepEqual(plan.tracks[0].clips.map((clip) => clip.id), ["clip-a", "clip-b"]);
  assert.equal(plan.tracks[0].clips[1].timeline.end, 9);
  assert.equal(plan.tracks[0].clips[1].keyframes[0].at, 7);
  assert.deepEqual(plan.tracks[0].clips[1].transitions.in, {
    type: "crossfade", duration: 1, durationFrames: 30, startFrame: 150, endFrame: 180,
  });
  assert.deepEqual(
    { startFrame: plan.tracks[0].clips[1].timeline.startFrame, endFrame: plan.tracks[0].clips[1].timeline.endFrame, frameDuration: plan.tracks[0].clips[1].timeline.frameDuration },
    { startFrame: 150, endFrame: 270, frameDuration: 120 },
  );
  assert.match(plan.limitations[0], /no media has been fetched or rendered/);
});

test("preserves clip audio across video and audio tracks unless muted or excluded", () => {
  const input = project();
  input.tracks[1].muted = true;
  const plan = compileVideoRenderPlan(input);
  assert.equal(plan.tracks[0].clips[0].playback.volume, 0.8);
  assert.equal(plan.tracks[1].clips[0].playback.volume, 0);
  const silent = compileVideoRenderPlan(project(), { includeAudio: false });
  assert.ok(silent.tracks.every((track) => track.clips.every((clip) => clip.playback.volume === 0 && clip.playback.muted)));
});

test("normalizes supported export settings and frame counts", () => {
  const plan = compileVideoRenderPlan(project(), { width: 1080, height: 1920, fps: 60, format: "mp4", codec: "h264" });
  assert.deepEqual(plan.output, { width: 1080, height: 1920, fps: 60, format: "mp4", codec: "h264", includeAudio: true });
  assert.equal(plan.frameCount, 540);
  assert.deepEqual(VIDEO_EXPORT_LIMITS.frameRates, [24, 25, 30, 50, 60]);
});

test("rejects invalid dimensions, odd H.264 sizes and unsupported codec combinations", () => {
  assert.throws(() => compileVideoRenderPlan(project(), { width: 4000 }), /16 to 3840/);
  assert.throws(() => compileVideoRenderPlan(project(), { width: 1081, height: 1920 }), /even numbers/);
  assert.throws(() => compileVideoRenderPlan(project(), { format: "mp4", codec: "vp9" }), /combination is unsupported/);
  assert.throws(() => compileVideoRenderPlan(project(), { fps: 48 }), /frame rate/);
  assert.throws(() => compileVideoRenderPlan(project(), { includeAudio: "yes" }), /boolean/);
});

test("supports VP9 WebM and rejects invalid edit graphs before compiling", () => {
  const plan = compileVideoRenderPlan(project(), { width: 1280, height: 720, format: "webm", codec: "vp9" });
  assert.equal(plan.output.format, "webm");
  assert.equal(plan.output.codec, "vp9");
  const invalid = project();
  invalid.tracks[0].clips[0].duration = -2;
  assert.throws(() => compileVideoRenderPlan(invalid), /duration/);
});

test("freezes plan output and does not mutate source project", () => {
  const input = project();
  const before = JSON.stringify(input);
  const plan = compileVideoRenderPlan(input);
  assert.equal(JSON.stringify(input), before);
  assert.ok(Object.isFrozen(plan));
  assert.ok(Object.isFrozen(plan.tracks));
  assert.ok(Object.isFrozen(plan.tracks[0].clips[0].playback));
  assert.throws(() => plan.assets.push("injected"));
});


test("compiles fractional clip timing, keyframes and transitions onto integer frame boundaries", () => {
  const input = {
    id: "fractional-project",
    tracks: [{
      id: "picture", type: "video", name: "Picture", clips: [{
        id: "clip-fractional", assetId: "asset-fractional",
        start: 0.1, duration: 0.2, sourceStart: 0, sourceDuration: 0.2,
        keyframes: [{ at: 0.1, property: "opacity", value: 0.75 }],
        transitionIn: "crossfade", transitionInDuration: 0.05,
        transitionOut: "dip-black", transitionOutDuration: 0.05,
      }],
    }],
  };
  const plan = compileVideoRenderPlan(input, { fps: 24 });
  const clip = plan.tracks[0].clips[0];
  assert.deepEqual(
    { start: clip.timeline.startFrame, end: clip.timeline.endFrame, duration: clip.timeline.frameDuration },
    { start: 2, end: 7, duration: 5 },
  );
  assert.equal(clip.keyframes[0].frame, 5);
  assert.deepEqual(
    { start: clip.transitions.in.startFrame, end: clip.transitions.in.endFrame, frames: clip.transitions.in.durationFrames },
    { start: 2, end: 3, frames: 1 },
  );
  assert.deepEqual(
    { start: clip.transitions.out.startFrame, end: clip.transitions.out.endFrame, frames: clip.transitions.out.durationFrames },
    { start: 6, end: 7, frames: 1 },
  );
  assert.equal(plan.frameCount, 7);
});

test("compiles volume automation into frame-indexed audio mix instructions", () => {
  const input = project();
  input.tracks[1].clips[0].keyframes = [
    { at: 0, property: "volume", value: 0.2, easing: "linear" },
    { at: 4, property: "volume", value: 0.8, easing: "ease-in" },
  ];
  const plan = compileVideoRenderPlan(input, { fps: 30 });
  assert.deepEqual(plan.tracks[1].clips[0].playback.volumeAutomation, [
    { frame: 30, at: 1, value: 0.2, easing: "linear" },
    { frame: 150, at: 5, value: 0.8, easing: "ease-in" },
  ]);
  const silent = compileVideoRenderPlan(input, { includeAudio: false });
  assert.ok(silent.tracks[1].clips[0].playback.volumeAutomation.every((point) => point.value === 0));
});
