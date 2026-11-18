import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildImageEditPrompt,
  detectImageEditStyleFromPrompt,
  IMAGE_EDIT_STYLES,
  isImageEditRequest,
  parseImageEditInput,
  parseImageEditOutput,
} from "./image-edit.mjs";

test("offers explicit image-to-image styles and user edit constraints", () => {
  assert.deepEqual(IMAGE_EDIT_STYLES.map((style) => style.id), ["cartoon", "anime", "comic", "3d-animation", "watercolor"]);
  const prompt = buildImageEditPrompt("cartoon", { change: "make the background a watercolor landscape", preserve: "keep the same jacket" });
  assert.match(prompt, /retain every original person/);
  assert.match(prompt, /complete content and composition/);
  assert.match(prompt, /create a sticker/);
  assert.match(prompt, /input_image_0/);
  assert.match(prompt, /USER-REQUESTED CHANGE: make the background a watercolor landscape/);
  assert.match(prompt, /USER-REQUESTED PRESERVATION: keep the same jacket/);
  assert.match(buildImageEditPrompt("cartoon", { change: "x".repeat(500) }), /USER-REQUESTED CHANGE:/);
  assert.equal(buildImageEditPrompt("unknown"), null);
});

test("all photo styles demand a cohesive full-frame edit instead of a replacement portrait or sticker", () => {
  for (const style of IMAGE_EDIT_STYLES) {
    const prompt = buildImageEditPrompt(style.id);
    assert.match(prompt, /input_image_0 is the photograph to edit/);
    assert.match(prompt, /complete source photograph/);
    assert.match(prompt, /entire image, edge to edge/);
    assert.match(prompt, /same overall photograph/);
    assert.match(prompt, /DO NOT: create a sticker/);
    assert.match(prompt, /preserve the source content and composition/);
  }
  assert.match(buildImageEditPrompt("cartoon"), /Cartoonise the people, objects and background together/);
  assert.match(buildImageEditPrompt("anime"), /complete source photograph as one cohesive anime-style scene/);
  assert.match(buildImageEditPrompt("watercolor"), /do not crop to a portrait/);
});

test("validates data URL MIME type and image size before provider upload", () => {
  assert.deepEqual(parseImageEditInput("data:image/png;base64,YWJj"), { mimeType: "image/png", base64: "YWJj", estimatedBytes: 3 });
  assert.equal(parseImageEditInput("https://example.com/photo.png"), null);
  assert.equal(parseImageEditInput("data:image/svg+xml;base64,PHN2Zz4="), null);
  assert.equal(parseImageEditInput("data:image/png;base64,%%%"), null);
  assert.equal(parseImageEditInput("data:image/png;base64,YQ="), null);
  assert.equal(parseImageEditInput("data:image/png;base64,Y"), null);
  assert.equal(parseImageEditInput("data:image/png;base64,YQ==", 0), null);
  assert.equal(parseImageEditInput(`data:image/jpeg;base64,${"A".repeat(5_600_000)}`), null);
});

test("accepts only bounded base64 PNG output with a valid IHDR header", () => {
  const pngHeader = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(pngHeader, 0);
  pngHeader.writeUInt32BE(13, 8);
  pngHeader.write("IHDR", 12, "ascii");
  pngHeader.writeUInt32BE(1, 16);
  pngHeader.writeUInt32BE(1, 20);
  pngHeader[24] = 8;
  pngHeader[25] = 6;
  const validPng = pngHeader.toString("base64");
  assert.deepEqual(parseImageEditOutput(validPng), { base64: validPng, estimatedBytes: 33 });
  assert.equal(parseImageEditOutput("PGh0bWw+"), null);
  assert.equal(parseImageEditOutput("%%%"), null);
  assert.equal(parseImageEditOutput(validPng, 24), null);
  assert.equal(parseImageEditOutput(validPng.slice(0, -2)), null);
  assert.equal(parseImageEditOutput(null), null);
});

test("image edit API uses authenticated FLUX.2 Klein multipart photo input and edit constraints", async () => {
  const source = await readFile(new URL("../../app/api/images/edit/route.js", import.meta.url), "utf8");
  assert.match(source, /flux-2-klein-9b/);
  assert.match(source, /input_image_0/);
  assert.match(source, /new FormData\(\)/);
  assert.match(source, /buildImageEditPrompt\(style, \{/);
  assert.match(source, /changeRequest/);
  assert.match(source, /preserveRequest/);
  assert.match(source, /auth\.getUser\(\)/);
});

test("Image Studio exposes photo transformation, constraints and before-after comparison", async () => {
  const source = await readFile(new URL("../../app/learn/native-image-studio.jsx", import.meta.url), "utf8");
  assert.match(source, /Transform my photo/);
  assert.match(source, /fetch\("\/api\/images\/edit"/);
  assert.match(source, /Keep the same person, face, pose and scene/);
  assert.match(source, /Full-frame cartoon illustration/);
  assert.match(source, /What should change\?/);
  assert.match(source, /What must stay the same\?/);
  assert.match(source, /native-image-before-after/);
  assert.match(source, /Original uploaded photo/);
  assert.match(source, /Transformed result/);
});

test("Image Studio prevents duplicate edits and protects the original photo during retries", async () => {
  const source = await readFile(new URL("../../app/learn/native-image-studio.jsx", import.meta.url), "utf8");
  assert.match(source, /editInFlightRef\.current/);
  assert.match(source, /const sourceFile = referenceImage/);
  assert.match(source, /new AbortController\(\)/);
  assert.match(source, /controller\.abort\(\)/);
  assert.match(source, /disabled=\{editing\} onChange=\{\(event\) => \{ chooseReferenceImage/);
  assert.match(source, /Your original photo is safe—try again/);
  assert.match(source, /Your original upload is still preserved/);
});

test("recognises attached-photo cartoon requests without misclassifying normal chat", () => {
  assert.equal(isImageEditRequest("convert my image into cartoon", true), true);
  assert.equal(isImageEditRequest("create a cartoon from this photo", true), true);
  assert.equal(isImageEditRequest("turn this photo into an anime illustration", true), true);
  assert.equal(isImageEditRequest("what is in this photo?", true), false);
  assert.equal(isImageEditRequest("convert my image into cartoon", false), false);
  assert.equal(detectImageEditStyleFromPrompt("make it a cartoon"), "cartoon");
  assert.equal(detectImageEditStyleFromPrompt("make it anime"), "anime");
  assert.equal(detectImageEditStyleFromPrompt("turn it into a comic"), "comic");
});

test("assistant routes attached-photo style conversions to image editing before text-to-image", async () => {
  const source = await readFile(new URL("../../app/assistant-workspace.jsx", import.meta.url), "utf8");
  const editIndex = source.indexOf("if (imageFile && isImageEditRequest(text, true))");
  const generationIndex = source.indexOf("if (isImageGenerationRequest(text))");
  assert.ok(editIndex >= 0 && generationIndex > editIndex);
  assert.match(source, /fetch\("\/api\/images\/edit"/);
  assert.match(source, /detectImageEditStyleFromPrompt\(text\)/);
  assert.match(source, /prepareImageForEditing\(sourceFile\)/);
  assert.match(source, /setImageFile\(sourceFile\)/);
});

test("prepares photo input within the model's 512px reference-image limit", async () => {
  const source = await readFile(new URL("./image-edit.mjs", import.meta.url), "utf8");
  assert.match(source, /maxDimension = 512/);
  assert.match(source, /createElement\("canvas"\)/);
  assert.match(source, /drawImage\(image, 0, 0, width, height\)/);
  assert.match(source, /toBlob\(resolve, "image\/jpeg", 0\.9\)/);
  assert.match(source, /outputScale = 1024/);
});

test("Image Studio offers a local original-photo colour-grade export without an AI request", async () => {
  const source = await readFile(new URL("../../app/learn/native-image-studio.jsx", import.meta.url), "utf8");
  assert.match(source, /exportOriginalPhotoWithLocalGrade/);
  assert.match(source, /Export original with local grade \(free\)/);
  assert.match(source, /Original photo exported with the selected local colour grade\. No AI service was used\./);
  const localExport = source.slice(source.indexOf("async function exportOriginalPhotoWithLocalGrade"), source.indexOf("function exportSvg"));
  assert.match(localExport, /URL\.createObjectURL\(referenceImage\)/);
  assert.match(localExport, /applyCubeLutToImageData/);
  assert.match(localExport, /setTimeout\(\(\) => URL\.revokeObjectURL\(downloadUrl\), 1000\)/);
  assert.doesNotMatch(localExport, /fetch\(/);
});

test("Image Studio supports local rotate and flip controls in the original-photo export", async () => {
  const source = await readFile(new URL("../../app/learn/native-image-studio.jsx", import.meta.url), "utf8");
  assert.match(source, /Rotate left/);
  assert.match(source, /Rotate right/);
  assert.match(source, /Flip horizontal/);
  assert.match(source, /setPhotoRotation\(\(value\) => \(value \+ 90\) % 360\)/);
  assert.match(source, /context\.rotate\(\(photoRotation \* Math\.PI\) \/ 180\)/);
  assert.match(source, /context\.scale\(photoFlipX \? -1 : 1, 1\)/);
  assert.match(source, /const sideways = Math\.abs\(photoRotation % 180\) === 90/);
  const localExport = source.slice(source.indexOf("async function exportOriginalPhotoWithLocalGrade"), source.indexOf("function exportSvg"));
  assert.doesNotMatch(localExport, /fetch\(/);
});
