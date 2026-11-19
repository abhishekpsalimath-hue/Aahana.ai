import test from "node:test";
import assert from "node:assert/strict";
import {
  IMAGE_WORKFLOW_LIMITS,
  isAllowedPrompt,
  isSafeProviderImageUrl,
  parseGuardVerdict,
  parseImageDataUrl,
  parseVisualSafetyVerdict,
} from "./image-workflow.mjs";

test("image workflow accepts only bounded base64 raster data URLs", () => {
  const encoded = Buffer.from("image-bytes").toString("base64");
  assert.equal(parseImageDataUrl("data:image/jpeg;base64," + encoded).mimeType, "image/jpeg");
  assert.equal(parseImageDataUrl("data:image/webp;base64," + encoded).mimeType, "image/webp");
  assert.equal(parseImageDataUrl("data:image/svg+xml;base64," + encoded), null);
  assert.equal(parseImageDataUrl("https://example.com/image.jpg"), null);
  assert.equal(parseImageDataUrl("data:image/jpeg;base64,%%%"), null);
  assert.equal(IMAGE_WORKFLOW_LIMITS.maxBytes, 2 * 1024 * 1024);
});

test("image workflow validates bounded prompts", () => {
  assert.equal(isAllowedPrompt("restore this photo"), true);
  assert.equal(isAllowedPrompt("  "), false);
  assert.equal(isAllowedPrompt("x".repeat(2049)), false);
});

test("prompt safety parser fails closed on ambiguous model output", () => {
  assert.deepEqual(parseGuardVerdict("safe"), { safe: true });
  assert.deepEqual(parseGuardVerdict("unsafe\nS3"), { safe: false });
  assert.equal(parseGuardVerdict("probably safe"), null);
});

test("visual safety parser requires an explicit boolean verdict", () => {
  assert.deepEqual(parseVisualSafetyVerdict('{"safe":true,"reason":"ordinary landscape"}'), { safe: true, reason: "ordinary landscape" });
  assert.deepEqual(parseVisualSafetyVerdict('{"safe":false}'), { safe: false, reason: "" });
  assert.equal(parseVisualSafetyVerdict("looks fine"), null);
});

test("provider output URLs are HTTPS and restricted to Cloudflare AI image hosts", () => {
  assert.equal(isSafeProviderImageUrl("https://examples.aig.cloudflare.com/image.jpg"), true);
  assert.equal(isSafeProviderImageUrl("http://examples.aig.cloudflare.com/image.jpg"), false);
  assert.equal(isSafeProviderImageUrl("https://attacker.example/image.jpg"), false);
});
