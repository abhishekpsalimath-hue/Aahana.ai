import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createImageScene, renderImageSceneSvg, validateImageScene } from "./image-engine.mjs";
import { applyCubeLutToImageData, parseCubeLut } from "./cube-lut.mjs";

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
  const cinematic = buildPinterestInspiredPrompt({ notes: "dramatic scene", style: "cinematic" });
  assert.match(cinematic, /cinematic lighting/);
  const unknown = buildPinterestInspiredPrompt({ notes: "clean layout", style: "untrusted-style" });
  assert.match(unknown, /premium editorial/);
  assert.equal(buildPinterestInspiredPrompt({ notes: "   " }), "");
});


test("accepts only HTTPS Pinterest reference links", async () => {
  const { sanitizePinterestReferenceUrl } = await import("./image-engine.mjs");
  assert.equal(sanitizePinterestReferenceUrl("https://www.pinterest.com/pin/123/"), "https://www.pinterest.com/pin/123/");
  assert.equal(sanitizePinterestReferenceUrl("https://pin.it/abc"), "https://pin.it/abc");
  assert.equal(sanitizePinterestReferenceUrl("http://pinterest.com/pin/123"), "");
  assert.equal(sanitizePinterestReferenceUrl("https://evil.example/pinterest.com"), "");
  assert.equal(sanitizePinterestReferenceUrl("javascript:alert(1)"), "");
});

test("exports cinematic colour grading presets in vector SVG output", async () => {
  const { COLOR_GRADES, getColorGradeFilter } = await import("./color-grading.mjs");
  assert.equal(COLOR_GRADES.length, 33);
  for (const id of ["teal-orange", "cross-processed", "desaturated", "technicolor", "duotone", "bleach-bypass", "colour-negative", "kodachrome", "day-for-night", "infrared", "neo-noir", "night-vision", "thermal"]) {
    assert.notEqual(getColorGradeFilter(id), "none");
  }
  assert.equal(getColorGradeFilter("not-a-grade"), "none");
  const svg = renderImageSceneSvg(createImageScene(), "teal-orange");
  assert.match(svg, /filter:saturate\(1\.35\)/);
});

test("image studio applies selected colour grade to previews and exported generated images", async () => {
  const source = await readFile(new URL("../../app/learn/native-image-studio.jsx", import.meta.url), "utf8");
  assert.match(source, /style=\{\{ filter: generatedImage \? gradeFilter : "none" \}\}/);
  assert.match(source, /context\.filter = gradeFilter/);
  assert.match(source, /aahana-graded-image\.png/);
  assert.match(source, /renderImageSceneSvg\(scene, colorGrade\)/);
});


test("parses a standard 2-point identity 3D .cube LUT", () => {
  const cube = [
    "TITLE \"Identity\"",
    "LUT_3D_SIZE 2",
    "DOMAIN_MIN 0 0 0",
    "DOMAIN_MAX 1 1 1",
    "0 0 0", "1 0 0", "0 1 0", "1 1 0",
    "0 0 1", "1 0 1", "0 1 1", "1 1 1",
  ].join("\\n");
  const lut = parseCubeLut(cube);
  assert.equal(lut.size, 2);
  const imageData = { data: new Uint8ClampedArray([0, 128, 255, 255, 255, 0, 0, 64]) };
  applyCubeLutToImageData(imageData, lut);
  assert.deepEqual([...imageData.data], [0, 128, 255, 255, 255, 0, 0, 64]);
});

test("rejects malformed, oversized, incomplete and non-finite .cube LUT files", () => {
  assert.equal(parseCubeLut("not a cube"), null);
  assert.equal(parseCubeLut("LUT_3D_SIZE 65"), null);
  assert.equal(parseCubeLut("LUT_3D_SIZE 2\\n0 0 0"), null);
  assert.equal(parseCubeLut("LUT_3D_SIZE 2\\nDOMAIN_MAX 0 0 0"), null);
  assert.equal(parseCubeLut("LUT_3D_SIZE 2\\nNaN 0 0"), null);
  assert.equal(parseCubeLut("x".repeat(2_000_001)), null);
});

test("applies custom 3D LUT values while preserving image alpha", () => {
  const cube = ["LUT_3D_SIZE 2", "0 0 0", "0.5 0 0", "0 0.5 0", "0.5 0.5 0", "0 0 0.5", "0.5 0 0.5", "0 0.5 0.5", "0.5 0.5 0.5"].join("\\n");
  const lut = parseCubeLut(cube);
  const imageData = { data: new Uint8ClampedArray([255, 255, 255, 77]) };
  applyCubeLutToImageData(imageData, lut);
  assert.deepEqual([...imageData.data], [128, 128, 128, 77]);
});

test("Image Studio exposes local custom LUT import and applies it to PNG export", async () => {
  const source = await readFile(new URL("../../app/learn/native-image-studio.jsx", import.meta.url), "utf8");
  assert.match(source, /accept="\.cube,text\/plain"/);
  assert.match(source, /parseCubeLut\(await file\.text\(\)\)/);
  assert.match(source, /applyCubeLutToImageData\(pixels, cubeLut\)/);
  assert.match(source, /getImageData\(0, 0, canvas\.width, canvas\.height\)/);
});
