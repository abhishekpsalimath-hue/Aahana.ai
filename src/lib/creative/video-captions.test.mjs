import test from "node:test";
import assert from "node:assert/strict";
import { validateVideoCaptionTrack, exportVideoCaptionsAsSrt, exportVideoCaptionsAsWebVtt, VIDEO_CAPTION_LIMITS } from "./video-captions.mjs";

const track = () => ({
  language: "en-IN",
  label: "English (India)",
  cues: [
    { id: "cue-02", start: 3.25, end: 5.5, text: "Keep the same subject.", speaker: "Narrator" },
    { id: "cue-01", start: 0, end: 2.75, text: "A new story begins." },
  ],
});

test("validates, sorts and freezes a single-language caption track", () => {
  const result = validateVideoCaptionTrack(track(), { durationSeconds: 6 });
  assert.equal(result.language, "en-IN");
  assert.equal(result.label, "English (India)");
  assert.deepEqual(result.cues.map((cue) => cue.id), ["cue-01", "cue-02"]);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.cues));
  assert.equal(result.cues[1].speaker, "Narrator");
});

test("exports deterministic SubRip timestamps and speaker labels", () => {
  const result = exportVideoCaptionsAsSrt(track(), { durationSeconds: 6 });
  assert.equal(result, [
    "1",
    "00:00:00,000 --> 00:00:02,750",
    "A new story begins.",
    "",
    "2",
    "00:00:03,250 --> 00:00:05,500",
    "Narrator: Keep the same subject.",
    "",
  ].join("\n"));
});

test("exports WebVTT with language-independent cue identifiers", () => {
  const result = exportVideoCaptionsAsWebVtt(track(), { durationSeconds: 6 });
  assert.equal(result, [
    "WEBVTT",
    "",
    "cue-01",
    "00:00:00.000 --> 00:00:02.750",
    "A new story begins.",
    "",
    "cue-02",
    "00:00:03.250 --> 00:00:05.500",
    "Narrator: Keep the same subject.",
    "",
  ].join("\n"));
});

test("preserves multilingual scripts and removes unsafe control characters and markup delimiters", () => {
  const input = { language: "kn-IN", cues: [
    { id: "cue-kn", start: 0, end: 2, text: "ನಮಸ್ಕಾರ <script>\u0000" },
  ] };
  const result = validateVideoCaptionTrack(input);
  assert.equal(result.cues[0].text, "ನಮಸ್ಕಾರ ‹script›");
  assert.match(exportVideoCaptionsAsSrt(input), /ನಮಸ್ಕಾರ ‹script›/);
});

test("rejects malformed language tags, cue IDs, duplicate IDs and invalid timing", () => {
  const badLanguage = track();
  badLanguage.language = "english language";
  assert.throws(() => validateVideoCaptionTrack(badLanguage), /language tag/);
  const duplicate = track();
  duplicate.cues[1].id = duplicate.cues[0].id;
  assert.throws(() => validateVideoCaptionTrack(duplicate), /unique stable identifiers/);
  const badId = track();
  badId.cues[0].id = "../private";
  assert.throws(() => validateVideoCaptionTrack(badId), /unique stable identifiers/);
  const badRange = track();
  badRange.cues[0].end = badRange.cues[0].start;
  assert.throws(() => validateVideoCaptionTrack(badRange), /after its start/);
  const overlap = track();
  overlap.cues[0].start = 2;
  assert.throws(() => validateVideoCaptionTrack(overlap), /cannot overlap/);
});

test("enforces caption count, duration, text and video-duration bounds", () => {
  const tooLong = track();
  tooLong.cues[0].text = "x".repeat(301);
  assert.throws(() => validateVideoCaptionTrack(tooLong), /1–300 characters/);
  const tooManyLines = track();
  tooManyLines.cues[0].text = "one\ntwo\nthree";
  assert.throws(() => validateVideoCaptionTrack(tooManyLines), /two lines/);
  const longCue = track();
  longCue.cues[0].end = longCue.cues[0].start + 11;
  assert.throws(() => validateVideoCaptionTrack(longCue), /10 seconds/);
  assert.throws(() => validateVideoCaptionTrack(track(), { durationSeconds: 4 }), /beyond the video duration/);
  const many = track();
  many.cues = Array.from({ length: VIDEO_CAPTION_LIMITS.maxCues + 1 }, (_, index) => ({
    id: "cue-" + index, start: index * 0.2, end: index * 0.2 + 0.1, text: "x",
  }));
  assert.throws(() => validateVideoCaptionTrack(many), /between 1 and 500/);
});

test("rejects malformed tracks and non-text caption values", () => {
  assert.throws(() => validateVideoCaptionTrack(null), /object is required/);
  assert.throws(() => validateVideoCaptionTrack({ language: "en", cues: [] }), /between 1 and 500/);
  const bad = track();
  bad.cues[0].text = " ";
  assert.throws(() => validateVideoCaptionTrack(bad), /Caption text/);
});
