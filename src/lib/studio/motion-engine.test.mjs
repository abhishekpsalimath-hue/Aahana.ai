import test from "node:test";
import assert from "node:assert/strict";
import { createMotionTimeline, sampleMotionTimeline, sampleMotionTrack, validateMotionTimeline } from "./motion-engine.mjs";

test("creates and validates an empty native timeline", () => {
  const timeline = createMotionTimeline();
  assert.deepEqual(validateMotionTimeline(timeline), timeline);
});

test("interpolates a position track at the requested time", () => {
  const timeline = { duration: 2000, fps: 30, tracks: [{ id: "move", layerIndex: 0, property: "x", keyframes: [{ time: 0, value: 10 }, { time: 2000, value: 210 }] }] };
  assert.equal(sampleMotionTrack(timeline.tracks[0], 1000), 110);
  assert.equal(sampleMotionTimeline(timeline, 1500)[0].value, 160);
});

test("supports easing and clamps sampling to the timeline", () => {
  const track = { keyframes: [{ time: 0, value: 0, easing: "ease-in" }, { time: 1000, value: 100 }] };
  assert.equal(sampleMotionTrack(track, 500), 25);
  assert.equal(sampleMotionTrack(track, -100), 0);
  assert.equal(sampleMotionTrack(track, 5000), 100);
});

test("rejects unsafe properties, unordered keyframes and oversized timelines", () => {
  assert.equal(validateMotionTimeline({ tracks: [{ layerIndex: 0, property: "innerHTML", keyframes: [{ time: 0, value: 0 }, { time: 1, value: 1 }] }] }), null);
  assert.equal(validateMotionTimeline({ tracks: [{ layerIndex: 0, property: "x", keyframes: [{ time: 10, value: 0 }, { time: 5, value: 1 }] }] }), null);
  assert.equal(validateMotionTimeline({ tracks: Array(51).fill({}) }), null);
  assert.throws(() => sampleMotionTimeline({ tracks: [{ layerIndex: 0, property: "style", keyframes: [] }] }, 0), /Invalid Aahana motion timeline/);
});
