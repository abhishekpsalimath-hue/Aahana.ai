import test from "node:test";
import assert from "node:assert/strict";
import {
  detectImageMimeTypeFromBytes,
  getSafeImageUpscaleWorkerUrl,
  readStreamWithinLimit,
  validateImageUpscaleInput,
} from "./image-upscale.mjs";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

test("detects PNG, JPEG and WebP from file signatures", () => {
  assert.equal(detectImageMimeTypeFromBytes(PNG), "image/png");
  assert.equal(detectImageMimeTypeFromBytes(new Uint8Array([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
  assert.equal(detectImageMimeTypeFromBytes(new TextEncoder().encode("RIFFxxxxWEBP")), "image/webp");
});

test("rejects mismatched declared MIME types and empty bytes", () => {
  assert.equal(validateImageUpscaleInput(PNG, "image/jpeg").ok, false);
  assert.equal(validateImageUpscaleInput(new Uint8Array(), "image/png").ok, false);
});

test("rejects files over the 20 MB input limit", () => {
  assert.equal(validateImageUpscaleInput(new Uint8Array(20 * 1024 * 1024 + 1), "image/png").ok, false);
});

test("accepts valid PNG bytes", () => {
  assert.deepEqual(validateImageUpscaleInput(PNG, "image/png"), { ok: true, mimeType: "image/png" });
});

test("reads multipart request streams only up to the configured cap", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2]));
      controller.enqueue(new Uint8Array([3, 4]));
      controller.close();
    },
  });
  assert.deepEqual(Array.from(await readStreamWithinLimit(stream, 4)), [1, 2, 3, 4]);
});

test("cancels request streams that exceed the configured cap", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.enqueue(new Uint8Array([4, 5, 6]));
    },
    cancel() { cancelled = true; },
  });
  assert.equal(await readStreamWithinLimit(stream, 4), null);
  assert.equal(cancelled, true);
});

test("only accepts configured HTTPS Worker endpoints", () => {
  assert.equal(getSafeImageUpscaleWorkerUrl("https://upscale.example.workers.dev/upscale"), "https://upscale.example.workers.dev/upscale");
  assert.equal(getSafeImageUpscaleWorkerUrl("http://upscale.example/work"), null);
  assert.equal(getSafeImageUpscaleWorkerUrl("https://user:pass@example.com"), null);
  assert.equal(getSafeImageUpscaleWorkerUrl("http://localhost:8787"), null);
});
