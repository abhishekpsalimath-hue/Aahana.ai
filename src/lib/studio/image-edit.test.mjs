import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildImageEditPrompt,
  detectImageEditStyleFromPrompt,
  IMAGE_EDIT_STYLES,
  isImageEditRequest,
  parseImageEditInput,
} from "./image-edit.mjs";

test("offers explicit image-to-image visual styles and identity-preserving prompts", () => {
  assert.deepEqual(IMAGE_EDIT_STYLES.map((style) => style.id), ["cartoon", "anime", "comic", "3d-animation", "watercolor"]);
  assert.match(buildImageEditPrompt("cartoon"), /exact same person or people/);
  assert.match(buildImageEditPrompt("cartoon"), /full-frame image transformation/);
  assert.match(buildImageEditPrompt("cartoon"), /not a sticker/);
  assert.match(buildImageEditPrompt("cartoon"), /input_image_0/);
  assert.match(buildImageEditPrompt("cartoon", { change: "make the background a soft watercolor landscape", preserve: "keep the same jacket" }), /USER-REQUESTED CHANGE: make the background a soft watercolor landscape/);
  assert.match(buildImageEditPrompt("cartoon", { change: "x".repeat(500), preserve: "y".repeat(500) }), /USER-REQUESTED PRESERVATION:/);
  assert.equal(buildImageEditPrompt("unknown"), null);
});

test("validates data URL MIME type and image size before provider upload", () => {
  assert.deepEqual(parseImageEditInput("data:image/png;base64,YWJj"), {
    mimeType: "image/png", base64: "YWJj", estimatedBytes: 3,
  });
  assert.equal(parseImageEditInput("https://example.com/photo.png"), null);
  assert.equal(parseImageEditInput("data:image/svg+xml;base64,PHN2Zz4="), null);
  assert.equal(parseImageEditInput("data:image/png;base64,%%%"), null);
  const tooLarge = "A".repeat(5_600_000);
  assert.equal(parseImageEditInput(`data:image/jpeg;base64,${tooLarge}`), null);
});

test("image edit API uses FLUX.2 Klein multipart photo input", async () => {
  const source = await readFile(new URL("../../app/api/images/edit/route.js", import.meta.url), "utf8");
  assert.match(source, /flux-2-klein-9b/);
  assert.match(source, /input_image_0/);
  assert.match(source, /new FormData\(\)/);
  assert.match(source, /buildImageEditPrompt\(style\)/);
  assert.match(source, /auth\.getUser\(\)/);
});

test("Image Studio exposes a dedicated photo transformation action", async () => {
  const source = await readFile(new URL("../../app/learn/native-image-studio.jsx", import.meta.url), "utf8");
  assert.match(source, /Transform my photo/);
  assert.match(source, /fetch\("\/api\/images\/edit"/);
  assert.match(source, /Keep the same person, face, pose and scene/);
  assert.match(source, /Full-frame cartoon illustration/);
  assert.match(source, /native-image-before-after/);\n  assert.match(source, /What should change\\?/);\n  assert.match(source, /What must stay the same\\?/);
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
