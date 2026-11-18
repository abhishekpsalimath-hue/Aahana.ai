import test from "node:test";
import assert from "node:assert/strict";
import { createImageScene, renderImageSceneSvg, validateImageScene } from "./image-engine.mjs";

test("creates a valid Aahana-native vector scene", () => {
  const scene = createImageScene({ title: "Solar system", subtitle: "Explore the planets" });
  assert.equal(validateImageScene(scene).layers.length, 4);
  const svg = renderImageSceneSvg(scene);
  assert.match(svg, /<svg/);
  assert.match(svg, /Solar system/);
  assert.match(svg, /Explore the planets/);
});

test("escapes text and rejects unsafe layer types", () => {
  const svg = renderImageSceneSvg({ width: 320, height: 180, layers: [{ type: "text", text: "<script>alert(1)</script>", x: 4, y: 30 }] });
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /&lt;script&gt;/);
  assert.equal(validateImageScene({ layers: [{ type: "raw-svg", value: "<script/>" }] }), null);
});

test("clamps geometry, colors and dimensions to safe bounds", () => {
  const scene = validateImageScene({ width: 99999, height: -2, background: "url(javascript:alert(1))", layers: [{ type: "circle", cx: 99999, cy: -4, radius: 99999, fill: "red" }] });
  assert.equal(scene.width, 4096);
  assert.equal(scene.height, 64);
  assert.equal(scene.background, "#f4f0e8");
  assert.equal(scene.layers[0].cx, 4096);
  assert.equal(scene.layers[0].cy, 0);
  assert.equal(scene.layers[0].radius, 4096);
  assert.equal(scene.layers[0].fill, "#29243a");
});

test("rejects malformed and oversized scenes", () => {
  assert.equal(validateImageScene(null), null);
  assert.equal(validateImageScene({ layers: Array(101).fill({ type: "circle" }) }), null);
  assert.throws(() => renderImageSceneSvg({ layers: [{ type: "unknown" }] }), /Invalid Aahana image scene/);
});


test("builds an original prompt from Pinterest-inspired notes without forwarding the pin URL", async () => {
  const { buildPinterestInspiredPrompt } = await import("./image-engine.mjs");
  const prompt = buildPinterestInspiredPrompt({ title: "Study poster", notes: "Soft lilac palette, editorial typography, glowing 3D planet. https://pinterest.com/pin/123" });
  assert.match(prompt, /Study poster/);
  assert.match(prompt, /Soft lilac palette/);
  assert.doesNotMatch(prompt, /pinterest\\.com/);
  assert.match(prompt, /distinct and original/);
  assert.equal(buildPinterestInspiredPrompt({ notes: "   " }), "");
});
