import test from "node:test";
import assert from "node:assert/strict";
import { createReferenceImageFile } from "./reference-image-file.mjs";

test("preserves an already-small PNG reference without JPEG recompression", async () => {
  const source = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" });
  class FakeImage {
    naturalWidth = 480;
    naturalHeight = 320;
    set src(value) { this.source = value; }
    async decode() {}
  }
  const file = await createReferenceImageFile("data:image/png;base64,AQIDBA==", {
    ImageCtor: FakeImage,
    fetchImpl: async () => new Response(source),
  });
  assert.equal(file.type, "image/png");
  assert.equal(file.size, source.size);
  assert.deepEqual([...new Uint8Array(await file.arrayBuffer())], [1, 2, 3, 4]);
});

test("preserves an already-small WebP reference without changing its format", async () => {
  const source = new Blob([new Uint8Array([5, 6, 7])], { type: "image/webp" });
  class FakeImage {
    naturalWidth = 511;
    naturalHeight = 511;
    set src(value) { this.source = value; }
    async decode() {}
  }
  const file = await createReferenceImageFile("data:image/webp;base64,BQYH", {
    ImageCtor: FakeImage,
    fetchImpl: async () => new Response(source),
  });
  assert.equal(file.type, "image/webp");
  assert.equal(file.size, 3);
});

test("rejects unsupported source formats before attempting image preparation", async () => {
  let imageCreated = false;
  class FakeImage { constructor() { imageCreated = true; } }
  await assert.rejects(
    createReferenceImageFile("data:image/gif;base64,AA==", {
      ImageCtor: FakeImage,
      fetchImpl: async () => new Response(new Blob(["gif"], { type: "image/gif" })),
    }),
    /Attach a PNG, JPEG or WebP/
  );
  assert.equal(imageCreated, false);
});
