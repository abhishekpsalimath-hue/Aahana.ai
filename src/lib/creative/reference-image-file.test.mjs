import test from "node:test";
import assert from "node:assert/strict";
import { createReferenceImageFile, MAX_REFERENCE_IMAGE_BYTES, MAX_REFERENCE_IMAGE_EDGE } from "./reference-image-file.mjs";

function fakeImage(width, height) {
  return class FakeImage {
    naturalWidth = width;
    naturalHeight = height;
    set src(value) { this.source = value; }
    async decode() {}
  };
}

test("preserves small PNG bytes without JPEG recompression", async () => {
  const source = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" });
  const file = await createReferenceImageFile("data:image/png;base64,AQIDBA==", {
    ImageCtor: fakeImage(480, 320),
    fetchImpl: async () => new Response(source),
  });
  assert.equal(file.type, "image/png");
  assert.equal(file.size, source.size);
  assert.deepEqual([...new Uint8Array(await file.arrayBuffer())], [1, 2, 3, 4]);
});

test("preserves small WebP references and exact original bytes", async () => {
  const source = new Blob([new Uint8Array([5, 6, 7])], { type: "image/webp" });
  const file = await createReferenceImageFile("data:image/webp;base64,BQYH", {
    ImageCtor: fakeImage(511, 511),
    fetchImpl: async () => new Response(source),
  });
  assert.equal(file.type, "image/webp");
  assert.deepEqual([...new Uint8Array(await file.arrayBuffer())], [5, 6, 7]);
});

test("resizes oversized references to the provider edge limit", async () => {
  let drawn;
  const canvas = {
    width: 0, height: 0,
    getContext() {
      return { drawImage(image, x, y, width, height) { drawn = { width, height }; } };
    },
    toBlob(callback, type, quality) {
      assert.equal(type, "image/png");
      assert.equal(quality, undefined);
      callback(new Blob([new Uint8Array([9, 8, 7])], { type: "image/png" }));
    },
  };
  const source = new Blob([new Uint8Array(32)], { type: "image/png" });
  const file = await createReferenceImageFile("data:image/png;base64,AAAA", {
    ImageCtor: fakeImage(2048, 1024),
    fetchImpl: async () => new Response(source),
    documentRef: { createElement: () => canvas },
  });
  assert.deepEqual(drawn, { width: MAX_REFERENCE_IMAGE_EDGE, height: 256 });
  assert.equal(file.type, "image/png");
  assert.equal(file.size, 3);
});

test("falls back to bounded JPEG only when lossless resized output exceeds the upload cap", async () => {
  const requestedTypes = [];
  const canvas = {
    width: 0, height: 0,
    getContext() { return { drawImage() {} }; },
    toBlob(callback, type, quality) {
      requestedTypes.push({ type, quality });
      if (type === "image/png") callback(new Blob([new Uint8Array(MAX_REFERENCE_IMAGE_BYTES + 1)], { type }));
      else callback(new Blob([new Uint8Array([1, 2, 3])], { type }));
    },
  };
  const source = new Blob([new Uint8Array([1])], { type: "image/png" });
  const file = await createReferenceImageFile("data:image/png;base64,AQ==", {
    ImageCtor: fakeImage(1024, 1024),
    fetchImpl: async () => new Response(source),
    documentRef: { createElement: () => canvas },
  });
  assert.deepEqual(requestedTypes, [
    { type: "image/png", quality: undefined },
    { type: "image/jpeg", quality: 0.92 },
  ]);
  assert.equal(file.type, "image/jpeg");
  assert.equal(file.size, 3);
});

test("resizes an already-small image if its source bytes exceed the upload cap", async () => {
  let resized = false;
  const canvas = {
    width: 0, height: 0,
    getContext() { return { drawImage() { resized = true; } }; },
    toBlob(callback) { callback(new Blob([new Uint8Array([1])], { type: "image/jpeg" })); },
  };
  const source = new Blob([new Uint8Array(MAX_REFERENCE_IMAGE_BYTES + 1)], { type: "image/jpeg" });
  await createReferenceImageFile("data:image/jpeg;base64,AAAA", {
    ImageCtor: fakeImage(400, 300),
    fetchImpl: async () => new Response(source),
    documentRef: { createElement: () => canvas },
  });
  assert.equal(resized, true);
});

test("rejects unsupported formats, malformed URLs and invalid dimensions", async () => {
  await assert.rejects(createReferenceImageFile("https://example.test/image.png"), /Could not read/);
  await assert.rejects(createReferenceImageFile("data:image/png;base64,AA==", {
    fetchImpl: async () => new Response(new Blob(["gif"], { type: "image/gif" })),
  }), /Attach a PNG, JPEG or WebP/);
  await assert.rejects(createReferenceImageFile("data:image/png;base64,AA==", {
    ImageCtor: fakeImage(0, 300),
    fetchImpl: async () => new Response(new Blob(["x"], { type: "image/png" })),
  }), /invalid dimensions/);
  assert.equal(MAX_REFERENCE_IMAGE_BYTES, 2 * 1024 * 1024);
  assert.equal(MAX_REFERENCE_IMAGE_EDGE, 511);
});


test("preserves a generated 1024px image for video without downscaling to the edit limit", async () => {
  const source = new Blob([new Uint8Array([10, 20, 30])], { type: "image/png" });
  const file = await createReferenceImageFile("data:image/png;base64,ChQe", {
    ImageCtor: fakeImage(1024, 1024),
    fetchImpl: async () => new Response(source),
    maxEdge: 4096,
    maxBytes: 2 * 1024 * 1024,
  });
  assert.equal(file.type, "image/png");
  assert.deepEqual([...new Uint8Array(await file.arrayBuffer())], [10, 20, 30]);
});

test("applies the requested video edge and byte limits when preparation is needed", async () => {
  let drawn;
  const canvas = {
    width: 0, height: 0,
    getContext() { return { drawImage(image, x, y, width, height) { drawn = { width, height }; } }; },
    toBlob(callback, type) { callback(new Blob([new Uint8Array([4, 5])], { type: "image/png" })); },
  };
  const source = new Blob([new Uint8Array([1])], { type: "image/png" });
  const file = await createReferenceImageFile("data:image/png;base64,AQ==", {
    ImageCtor: fakeImage(6000, 3000),
    fetchImpl: async () => new Response(source),
    documentRef: { createElement: () => canvas },
    maxEdge: 4096,
    maxBytes: 2 * 1024 * 1024,
  });
  assert.deepEqual(drawn, { width: 4096, height: 2048 });
  assert.equal(file.size, 2);
});

test("rejects invalid provider-specific reference image limits", async () => {
  await assert.rejects(createReferenceImageFile("data:image/png;base64,AQ==", { maxEdge: 8192 }), /limits are invalid/);
  await assert.rejects(createReferenceImageFile("data:image/png;base64,AQ==", { maxBytes: 3 * 1024 * 1024 }), /limits are invalid/);
});
