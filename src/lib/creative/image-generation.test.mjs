import test from "node:test";
import assert from "node:assert/strict";
import { parseImageGenerationInput, parseImageEditInput, MAX_IMAGE_EDIT_BYTES, MAX_IMAGE_EDIT_PROMPT_LENGTH, MAX_IMAGE_EDIT_REQUEST_BYTES, getReferenceImageDimensions, isReferenceImageWithinProviderBounds, readBoundedStream } from "./image-generation.mjs";

test("defaults to automatic masterpiece image direction without asking the user to choose settings", () => {
  assert.deepEqual(parseImageGenerationInput({ prompt: "A moonlit forest" }), {
    ok: true, prompt: "A moonlit forest\n\nCreative direction: produce a premium, portfolio-worthy hero image. Establish one unmistakable focal subject and a deliberate visual hierarchy. Use intentional composition, believable perspective, rich but controlled color, nuanced lighting, dimensional depth, tactile material detail, and crisp subject separation. Make fine details coherent and purposeful; avoid visual clutter, accidental text, malformed anatomy, duplicate objects, plastic-looking textures, and oversharpening. Preserve the subject and specific details requested by the user. Do not add logos, words, or extra objects unless requested.", steps: 8, style: "none", quality: "masterpiece",
  });
});

test("accepts explicit supported eight-step image generation with automatic creative direction", () => {
  const result = parseImageGenerationInput({ prompt: "A moonlit forest", steps: 8 });
  assert.equal(result.ok, true);
  assert.equal(result.steps, 8);
  assert.equal(result.style, "none");
  assert.equal(result.quality, "masterpiece");
  assert.match(result.prompt, /A moonlit forest/);
  assert.match(result.prompt, /portfolio-worthy hero image/);
});

test("trims prompts and rejects empty or overlong prompts", () => {
  assert.equal(parseImageGenerationInput({ prompt: "  " }).ok, false);
  assert.equal(parseImageGenerationInput({ prompt: "x".repeat(2049) }).ok, false);
  const trimmed = parseImageGenerationInput({ prompt: "  a portrait  " });
  assert.equal(trimmed.ok, true);
  assert.match(trimmed.prompt, /^a portrait\n\nCreative direction:/);
});

test("rejects unsupported step values instead of forwarding them to the provider", () => {
  for (const steps of [0, 1, 5, 9, "8", null]) {
    assert.equal(parseImageGenerationInput({ prompt: "A portrait", steps }).ok, false);
  }
});

test("applies an approved visual art direction preset to the prompt", () => {
  const result = parseImageGenerationInput({ prompt: "A perfume bottle", style: "product-studio" });
  assert.equal(result.ok, true);
  assert.match(result.prompt, /premium commercial product photography/i);
  assert.equal(result.style, "product-studio");
});

test("masterpiece quality adds art direction and rejects unknown quality", () => {
  const result = parseImageGenerationInput({ prompt: "A perfume bottle", steps: 8, quality: "masterpiece" });
  assert.equal(result.ok, true);
  assert.equal(result.quality, "masterpiece");
  assert.match(result.prompt, /portfolio-worthy hero image/i);
  assert.equal(parseImageGenerationInput({ prompt: "A portrait", quality: "ultra" }).ok, false);
});

test("rejects unknown styles while retaining automatic creative direction for supported styles", () => {
  assert.equal(parseImageGenerationInput({ prompt: "A portrait", style: "unknown" }).ok, false);
  const styled = parseImageGenerationInput({ prompt: "A perfume bottle", style: "cinematic" });
  assert.equal(styled.ok, true);
  assert.match(styled.prompt, /portfolio-worthy hero image/i);
  assert.match(styled.prompt, /cinematic visual style/i);
});

test("recognizes Lord Shiva and preserves deity-specific iconography instead of generic saint imagery", () => {
  const result = parseImageGenerationInput({ prompt: "Generate a beautiful image of Lord Shiva" });
  assert.equal(result.ok, true);
  assert.match(result.prompt, /not a generic saint, monk, guru/i);
  assert.match(result.prompt, /crescent moon/i);
  assert.match(result.prompt, /trident/i);
  assert.match(result.prompt, /third eye/i);
});

test("recognizes Hanuman and explicitly preserves the vanara face", () => {
  const result = parseImageGenerationInput({ prompt: "Create an image of Hanuman" });
  assert.equal(result.ok, true);
  assert.match(result.prompt, /monkey-faced deity/i);
  assert.match(result.prompt, /vanara face/i);
  assert.match(result.prompt, /Do not replace the monkey-faced divine form/i);
});

test("recognizes Ganesha, Krishna, and Rama with their defining visual attributes", () => {
  assert.match(parseImageGenerationInput({ prompt: "Lord Ganesha" }).prompt, /elephant-headed/i);
  assert.match(parseImageGenerationInput({ prompt: "Lord Krishna" }).prompt, /peacock feather/i);
  assert.match(parseImageGenerationInput({ prompt: "Lord Rama" }).prompt, /bow/i);
});


test("validates conversational reference-image edits and bounded uploads", () => {
  assert.deepEqual(parseImageEditInput({
    prompt: "Make the background cinematic",
    imageType: "image/jpeg",
    imageSize: 120_000,
  }), { ok: true, prompt: "Make the background cinematic" });
  assert.equal(parseImageEditInput({ prompt: " ", imageType: "image/jpeg", imageSize: 20 }).ok, false);
  assert.equal(parseImageEditInput({ prompt: "Change it", imageType: "image/gif", imageSize: 20 }).ok, false);
  assert.equal(parseImageEditInput({ prompt: "Change it", imageType: "image/jpeg", imageSize: MAX_IMAGE_EDIT_BYTES + 1 }).ok, false);
  assert.equal(parseImageEditInput({ prompt: "x".repeat(MAX_IMAGE_EDIT_PROMPT_LENGTH + 1), imageType: "image/jpeg", imageSize: 20 }).ok, false);
});

test("parses PNG reference dimensions and enforces the strict 512px provider limit", () => {
  const png = new Uint8Array(33);
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  png.set([0x00, 0x00, 0x00, 0x0d], 8);
  png.set([0x49, 0x48, 0x44, 0x52], 12);
  new DataView(png.buffer).setUint32(16, 511);
  new DataView(png.buffer).setUint32(20, 480);
  const dimensions = getReferenceImageDimensions(png, "image/png");
  assert.deepEqual(dimensions, { width: 511, height: 480 });
  assert.equal(isReferenceImageWithinProviderBounds(dimensions), true);
  assert.equal(isReferenceImageWithinProviderBounds({ width: 512, height: 480 }), false);
  assert.equal(isReferenceImageWithinProviderBounds(null), false);
  const malformedPng = png.slice();
  malformedPng[7] = 0x00;
  assert.equal(getReferenceImageDimensions(malformedPng, "image/png"), null);
});

test("parses JPEG and WebP reference dimensions without trusting client metadata", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x07, 0x08, 0x01, 0xe0, 0x01, 0xff]);
  assert.deepEqual(getReferenceImageDimensions(jpeg, "image/jpeg"), { width: 511, height: 480 });

  const webp = new Uint8Array(30);
  webp.set([...new TextEncoder().encode("RIFF")], 0);
  webp.set([...new TextEncoder().encode("WEBP")], 8);
  webp.set([...new TextEncoder().encode("VP8X")], 12);
  webp[24] = 0xfe;
  webp[27] = 0xdf;
  assert.deepEqual(getReferenceImageDimensions(webp, "image/webp"), { width: 255, height: 224 });
});


test("bounded stream reader accepts uploads within the byte limit", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2]));
      controller.enqueue(new Uint8Array([3, 4]));
      controller.close();
    },
  });
  const result = await readBoundedStream(stream, 4);
  assert.equal(result.ok, true);
  assert.deepEqual([...result.bytes], [1, 2, 3, 4]);
  assert.equal(MAX_IMAGE_EDIT_REQUEST_BYTES, MAX_IMAGE_EDIT_BYTES + 128 * 1024);
});

test("bounded stream reader cancels uploads as soon as they exceed the byte limit", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.enqueue(new Uint8Array([4, 5]));
    },
    cancel() { cancelled = true; },
  });
  const result = await readBoundedStream(stream, 4);
  assert.deepEqual(result, { ok: false, tooLarge: true });
  assert.equal(cancelled, true);
});

test("bounded stream reader fails closed for invalid stream or limit", async () => {
  assert.deepEqual(await readBoundedStream(null, 100), { ok: false, tooLarge: false });
  assert.deepEqual(await readBoundedStream(new ReadableStream(), 0), { ok: false, tooLarge: false });
});


test("bounded multipart reconstruction preserves the boundary and parses image-edit fields", async () => {
  const form = new FormData();
  form.set("prompt", "Remove the background");
  form.set("referencePrompt", "Keep the product shape and label unchanged");
  form.set("image", new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], {
    type: "image/png",
  }), "reference.png");

  const originalRequest = new Request("https://aahana.test/api/images/edit", {
    method: "POST",
    body: form,
  });
  const bounded = await readBoundedStream(originalRequest.body, MAX_IMAGE_EDIT_REQUEST_BYTES);
  assert.equal(bounded.ok, true);

  const reconstructedRequest = new Request(originalRequest.url, {
    method: "POST",
    headers: originalRequest.headers,
    body: bounded.bytes,
  });
  const parsed = await reconstructedRequest.formData();
  const image = parsed.get("image");

  assert.equal(parsed.get("prompt"), "Remove the background");
  assert.equal(parsed.get("referencePrompt"), "Keep the product shape and label unchanged");
  assert.equal(image.name, "reference.png");
  assert.equal(image.type, "image/png");
  assert.equal(image.size, 4);
});
