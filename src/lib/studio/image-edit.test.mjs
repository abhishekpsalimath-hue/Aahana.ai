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
  assert.match(prompt, /exact same person or people/);
  assert.match(prompt, /full-frame image transformation/);
  assert.match(prompt, /not a sticker/);
  assert.match(prompt, /input_image_0/);
  assert.match(prompt, /USER-REQUESTED CHANGE: make the background a watercolor landscape/);
  assert.match(prompt, /USER-REQUESTED PRESERVATION: keep the same jacket/);
  assert.match(buildImageEditPrompt("cartoon", { change: "x".repeat(500) }), /USER-REQUESTED CHANGE:/);
  assert.equal(buildImageEditPrompt("unknown"), null);
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
