import test from "node:test";
import assert from "node:assert/strict";
import { readBoundedImageEditRequest, MAX_IMAGE_EDIT_REQUEST_BYTES } from "./bounded-image-edit-request.mjs";

function pngHeader(width = 256, height = 256) {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0, 0, 0, 13], 8);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return new Blob([bytes], { type: "image/png" });
}

function makeRequest(entries) {
  const form = new FormData();
  for (const [key, value] of entries) form.append(key, value);
  return new Request("https://aahana.test/api/images/edit", { method: "POST", body: form });
}

test("parses one bounded image with the requested edit and optional context", async () => {
  const result = await readBoundedImageEditRequest(makeRequest([
    ["prompt", "Change only the background to a garden"],
    ["referencePrompt", "Preserve the person's face, pose and clothing"],
    ["image", pngHeader()],
  ]));
  assert.equal(result.ok, true);
  assert.equal(result.prompt, "Change only the background to a garden");
  assert.equal(result.referencePrompt, "Preserve the person's face, pose and clothing");
  assert.equal(result.image.type, "image/png");
  assert.equal(result.image.size, 33);
});

test("rejects missing image, empty prompt, unsupported file type and oversized file", async () => {
  const noImage = await readBoundedImageEditRequest(makeRequest([["prompt", "Edit"]]));
  assert.equal(noImage.ok, false);
  const noPrompt = await readBoundedImageEditRequest(makeRequest([["image", pngHeader()]]));
  assert.equal(noPrompt.ok, false);
  const badType = await readBoundedImageEditRequest(makeRequest([
    ["prompt", "Edit"], ["image", new Blob(["not an image"], { type: "image/gif" })],
  ]));
  assert.equal(badType.ok, false);
  const large = await readBoundedImageEditRequest(makeRequest([
    ["prompt", "Edit"], ["image", new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], { type: "image/png" })],
  ]));
  assert.equal(large.ok, false);
});

test("rejects duplicate and unexpected multipart fields", async () => {
  const duplicate = await readBoundedImageEditRequest(makeRequest([
    ["prompt", "Edit"], ["prompt", "Override"], ["image", pngHeader()],
  ]));
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.error, /duplicate/);
  const extra = await readBoundedImageEditRequest(makeRequest([
    ["prompt", "Edit"], ["image", pngHeader()], ["admin", "true"],
  ]));
  assert.equal(extra.ok, false);
  assert.match(extra.error, /unsupported fields/);
});

test("rejects malformed multipart, non-multipart content and oversized streamed requests", async () => {
  const plain = new Request("https://aahana.test/api/images/edit", { method: "POST", body: "{}" });
  assert.equal((await readBoundedImageEditRequest(plain)).ok, false);
  const malformed = new Request("https://aahana.test/api/images/edit", {
    method: "POST", headers: { "content-type": "multipart/form-data; boundary=broken" }, body: "not multipart",
  });
  assert.equal((await readBoundedImageEditRequest(malformed)).ok, false);
  assert.ok(MAX_IMAGE_EDIT_REQUEST_BYTES > 2 * 1024 * 1024);
});

test("returns cancellation before reading a request body", async () => {
  const controller = new AbortController();
  controller.abort();
  const request = new Request("https://aahana.test/api/images/edit", {
    method: "POST", body: new FormData(), signal: controller.signal,
  });
  const result = await readBoundedImageEditRequest(request);
  assert.equal(result.status, 499);
});
