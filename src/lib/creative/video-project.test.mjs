import test from "node:test";
import assert from "node:assert/strict";
import { validateVideoProject, VIDEO_PROJECT_LIMITS } from "./video-project.mjs";

const project = () => ({
  id: "project-001", version: 1,
  tracks: [
    { id: "track-video", type: "video", name: "Main video", clips: [
      { id: "clip-02", assetId: "asset-b", start: 5, duration: 4, sourceStart: 1, sourceDuration: 4 },
      { id: "clip-01", assetId: "asset-a", start: 0, duration: 5 },
    ] },
    { id: "track-audio", type: "audio", name: "Voiceover", clips: [
      { id: "clip-voice", assetId: "asset-voice", start: 0, duration: 9, volume: 0.8 },
    ] },
  ],
});

test("validates and normalizes a multi-track non-destructive edit graph", () => {
  const result = validateVideoProject(project());
  assert.equal(result.clipCount, 3);
  assert.deepEqual(result.tracks[0].clips.map((clip) => clip.id), ["clip-01", "clip-02"]);
  assert.equal(result.tracks[1].clips[0].volume, 0.8);
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.tracks) && Object.isFrozen(result.tracks[0].clips));
  assert.equal(VIDEO_PROJECT_LIMITS.maxTracks, 32);
});

test("rejects duplicate identities, invalid track types and malformed ids", () => {
  const duplicate = project();
  duplicate.tracks[1].clips[0].id = "clip-01";
  assert.throws(() => validateVideoProject(duplicate), /unique/);
  const badTrack = project();
  badTrack.tracks[0].type = "unknown";
  assert.throws(() => validateVideoProject(badTrack), /Track type/);
  assert.throws(() => validateVideoProject({ ...project(), id: "../private" }), /identifier/);
});

test("rejects invalid timing, source ranges, volume and playback speed", () => {
  for (const clip of [
    { id: "clip-x", assetId: "asset-x", start: -1, duration: 2 },
    { id: "clip-x", assetId: "asset-x", start: 0, duration: 0 },
    { id: "clip-x", assetId: "asset-x", start: 0, duration: 2, sourceDuration: 1 },
    { id: "clip-x", assetId: "asset-x", start: 0, duration: 2, volume: 3 },
    { id: "clip-x", assetId: "asset-x", start: 0, duration: 2, speed: 0 },
  ]) {
    const input = project();
    input.tracks = [{ id: "track-one", type: "video", name: "Video", clips: [clip] }];
    assert.throws(() => validateVideoProject(input));
  }
});

test("validates ordered keyframes, easing and clip transitions", () => {
  const input = project();
  input.tracks = [{ id: "track-one", type: "video", name: "Video", clips: [{
    id: "clip-one", assetId: "asset-one", start: 0, duration: 8,
    keyframes: [
      { at: 6, property: "positionX", value: 40, easing: "ease-out" },
      { at: 0, property: "opacity", value: 1 },
    ],
    transitionIn: "crossfade", transitionInDuration: 2,
    transitionOut: "dip-black", transitionOutDuration: 1,
  }] }];
  const clip = validateVideoProject(input).tracks[0].clips[0];
  assert.deepEqual(clip.keyframes.map((frame) => frame.at), [0, 6]);
  assert.deepEqual(clip.transitionIn, { type: "crossfade", duration: 2 });
  assert.deepEqual(clip.transitionOut, { type: "dip-black", duration: 1 });
});

test("rejects duplicate, out-of-range and unsupported keyframes or transitions", () => {
  for (const clip of [
    { id: "c", assetId: "a", start: 0, duration: 4, keyframes: [{ at: 5, property: "opacity", value: 1 }] },
    { id: "c", assetId: "a", start: 0, duration: 4, keyframes: [{ at: 1, property: "opacity", value: 2 }] },
    { id: "c", assetId: "a", start: 0, duration: 4, keyframes: [{ at: 1, property: "opacity", value: 1 }, { at: 1, property: "opacity", value: 0 }] },
    { id: "c", assetId: "a", start: 0, duration: 4, transitionIn: "unknown", transitionInDuration: 1 },
    { id: "c", assetId: "a", start: 0, duration: 4, transitionIn: "crossfade", transitionInDuration: 3 },
  ]) {
    const input = project();
    input.tracks = [{ id: "track-one", type: "video", name: "Video", clips: [clip] }];
    assert.throws(() => validateVideoProject(input));
  }
});

test("enforces track and clip-count bounds", () => {
  const tooManyTracks = project();
  tooManyTracks.tracks = Array.from({ length: VIDEO_PROJECT_LIMITS.maxTracks + 1 }, (_, i) => ({
    id: "track-" + i, type: "video", name: "Track " + i, clips: [],
  }));
  assert.throws(() => validateVideoProject(tooManyTracks), /tracks/);
  const tooManyClips = project();
  tooManyClips.tracks = [{ id: "track-one", type: "video", name: "Video", clips:
    Array.from({ length: VIDEO_PROJECT_LIMITS.maxClips + 1 }, (_, i) => ({
      id: "clip-" + i, assetId: "asset-" + i, start: i, duration: 0.5,
    }))
  }];
  assert.throws(() => validateVideoProject(tooManyClips), /500 clips/);
});

test("normalizes without mutating the source project", () => {
  const input = project();
  const originalClip = { ...input.tracks[0].clips[0] };
  const result = validateVideoProject(input);
  assert.deepEqual(input.tracks[0].clips[0], originalClip);
  assert.equal(result.tracks[0].clips[0].start, 0);
});
