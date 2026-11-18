import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../../app/learn/native-motion-studio.jsx", import.meta.url), "utf8");

test("motion studio exposes independent animated property tracks", () => {
  assert.match(source, /function addTrack\(property\)/);
  assert.match(source, /property: "cy"/);
  assert.match(source, /property: "radius"/);
  assert.match(source, /property: "opacity"/);
  assert.match(source, /timeline\.tracks\.map\(\(track, trackIndex\)/);
  assert.match(source, /updateKeyframe\(trackIndex, index/);
});

test("motion studio renders sampled properties and exports local WebM", () => {
  assert.match(source, /sampleMotionTimeline\(valid, frameTime\)/);
  assert.match(source, /new MediaRecorder\(stream/);
  assert.match(source, /aahana-motion-preview\.webm/);
  assert.match(source, /No paid generation provider was used/);
});

test("motion studio keeps timeline JSON export available", () => {
  assert.match(source, /aahana-motion-timeline\.json/);
  assert.match(source, /validateMotionTimeline\(timeline\)/);
});

test("motion studio supports an independently animated text visual layer", () => {
  assert.match(source, /function addTextLayer\(\)/);
  assert.match(source, /layerIndex: 1, property: "x"/);
  assert.match(source, /layerIndex: 1, property: "y"/);
  assert.match(source, /layerIndex: 1, property: "opacity"/);
  assert.match(source, /textLayerEnabled && <text/);
  assert.match(source, /textLayer\.slice\(0, 80\)/);
});

test("motion text layer exposes script, editorial and size controls", () => {
  assert.match(source, /Caveat, cursive/);
  assert.match(source, /Georgia, serif/);
  assert.match(source, /setTextFont/);
  assert.match(source, /setTextSize/);
  assert.match(source, /fontFamily=\{textFont\}/);
});
