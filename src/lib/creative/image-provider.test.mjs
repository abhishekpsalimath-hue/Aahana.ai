import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_IMAGE_MODEL,
  ENHANCED_IMAGE_MODEL,
  getImageOutputMimeType,
  resolveImageModel,
  buildImageProviderRequest,
} from "./image-provider.mjs";

test("keeps FLUX.1 Schnell as the safe default unless enhanced model is explicitly selected", () => {
  assert.equal(resolveImageModel(undefined), DEFAULT_IMAGE_MODEL);
  assert.equal(resolveImageModel(""), DEFAULT_IMAGE_MODEL);
  assert.equal(resolveImageModel("unknown-model"), DEFAULT_IMAGE_MODEL);
  assert.equal(resolveImageModel("flux-2-klein-4b"), ENHANCED_IMAGE_MODEL);
});

test("builds the required multipart request for FLUX.2 Klein 4B without unsupported step settings", async () => {
  const request = buildImageProviderRequest({
    model: ENHANCED_IMAGE_MODEL,
    prompt: "A detailed devotional painting of Lord Shiva",
    steps: 8,
  });
  assert.equal(request.method, "POST");
  assert.equal(request.cache, "no-store");
  assert.equal(request.headers, undefined);
  assert.ok(request.body instanceof FormData);
  assert.equal(request.body.get("prompt"), "A detailed devotional painting of Lord Shiva");
  assert.equal(request.body.get("width"), "1024");
  assert.equal(request.body.get("height"), "1024");
  assert.equal(request.body.get("steps"), null);
});

test("preserves the existing JSON request contract for FLUX.1 Schnell", async () => {
  const request = buildImageProviderRequest({
    model: DEFAULT_IMAGE_MODEL,
    prompt: "A moonlit forest",
    steps: 8,
  });
  assert.equal(request.method, "POST");
  assert.equal(request.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(request.body), { prompt: "A moonlit forest", steps: 8 });
});

test("uses the correct output media type for each Cloudflare image model", () => {
  assert.equal(getImageOutputMimeType(DEFAULT_IMAGE_MODEL), "image/jpeg");
  assert.equal(getImageOutputMimeType(ENHANCED_IMAGE_MODEL), "image/png");
  assert.equal(getImageOutputMimeType("unknown-model"), "image/jpeg");
});
