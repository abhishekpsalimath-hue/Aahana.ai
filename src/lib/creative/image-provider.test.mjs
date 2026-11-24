import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_IMAGE_MODEL,
  ENHANCED_IMAGE_MODEL,
  ACCURACY_IMAGE_MODEL,
  getImageOutputMimeType,
  detectImageMimeTypeFromBase64,
  resolveImageModel,
  buildImageProviderRequest,
} from "./image-provider.mjs";

test("keeps FLUX.1 Schnell as the safe default unless enhanced model is explicitly selected", () => {
  assert.equal(resolveImageModel(undefined), DEFAULT_IMAGE_MODEL);
  assert.equal(resolveImageModel(""), DEFAULT_IMAGE_MODEL);
  assert.throws(() => resolveImageModel("unknown-model"), /Unsupported Aahana image model selection/);
  assert.throws(() => resolveImageModel("flux-2-klein-4b-typo"), /Unsupported Aahana image model selection/);
  assert.equal(resolveImageModel("flux-2-klein-4b"), ENHANCED_IMAGE_MODEL);
  assert.equal(resolveImageModel("flux-2-dev"), ACCURACY_IMAGE_MODEL);
});

test("builds an opt-in FLUX.2 Dev accuracy request with explicit quality controls", () => {
  const request = buildImageProviderRequest({
    model: ACCURACY_IMAGE_MODEL,
    prompt: "A detailed devotional painting of Lord Shiva",
    steps: 8,
    seed: 42,
  });
  assert.equal(request.method, "POST");
  assert.equal(request.cache, "no-store");
  assert.equal(request.headers, undefined);
  assert.ok(request.body instanceof FormData);
  assert.equal(request.body.get("prompt"), "A detailed devotional painting of Lord Shiva");
  assert.equal(request.body.get("width"), "1024");
  assert.equal(request.body.get("height"), "1024");
  assert.equal(request.body.get("steps"), "25");
  assert.equal(request.body.get("guidance"), "4");
  assert.equal(request.body.get("seed"), "42");
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
  assert.deepEqual(JSON.parse(request.body), { prompt: "A moonlit forest", steps: 8, width: 1024, height: 1024 });
});

test("uses the correct output media type for each Cloudflare image model", () => {
  assert.equal(getImageOutputMimeType(DEFAULT_IMAGE_MODEL), "image/jpeg");
  assert.equal(getImageOutputMimeType(ENHANCED_IMAGE_MODEL), "image/png");
  assert.equal(getImageOutputMimeType(ACCURACY_IMAGE_MODEL), "image/png");
  assert.equal(getImageOutputMimeType("unknown-model"), "image/jpeg");
});

test("detects actual PNG, JPEG, and WebP bytes instead of trusting a model label", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const webp = Buffer.from("RIFF0000WEBPVP8 ", "ascii");
  assert.equal(detectImageMimeTypeFromBase64(png.toString("base64")), "image/png");
  assert.equal(detectImageMimeTypeFromBase64(jpeg.toString("base64")), "image/jpeg");
  assert.equal(detectImageMimeTypeFromBase64(webp.toString("base64")), "image/webp");
});

test("rejects malformed, unsupported, and oversized provider image payloads", () => {
  assert.equal(detectImageMimeTypeFromBase64("not-an-image"), null);
  assert.equal(detectImageMimeTypeFromBase64("!!!!"), null);
  assert.equal(detectImageMimeTypeFromBase64(Buffer.from("GIF89a000000", "ascii").toString("base64")), null);
  assert.equal(detectImageMimeTypeFromBase64("A".repeat(24 * 1024 * 1024 + 4)), null);
  assert.equal(detectImageMimeTypeFromBase64(null), null);
});


test("passes portrait and widescreen dimensions to each provider request", () => {
  const portrait = buildImageProviderRequest({
    model: DEFAULT_IMAGE_MODEL, prompt: "A portrait", width: 768, height: 1024,
  });
  assert.deepEqual(JSON.parse(portrait.body), {
    prompt: "A portrait", steps: 8, width: 768, height: 1024,
  });
  const widescreen = buildImageProviderRequest({
    model: ACCURACY_IMAGE_MODEL, prompt: "A film still", width: 1024, height: 576,
  });
  assert.equal(widescreen.body.get("width"), "1024");
  assert.equal(widescreen.body.get("height"), "576");
});
