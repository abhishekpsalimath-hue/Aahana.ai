import test from "node:test";
import assert from "node:assert/strict";
import { parseImageGenerationInput, parseImageEditInput, MAX_IMAGE_EDIT_BYTES, MAX_IMAGE_EDIT_PROMPT_LENGTH, getReferenceImageDimensions, isReferenceImageWithinProviderBounds, inferImageAspectRatio, getGeneratedImageFileMetadata } from "./image-generation.mjs";
import { buildImageEditPrompt } from "./creative-director.mjs";

test("defaults to automatic masterpiece image direction without asking the user to choose settings", () => {
  assert.deepEqual(parseImageGenerationInput({ prompt: "A moonlit forest" }), {
    ok: true, prompt: "A moonlit forest\n\nCreative direction: produce a premium, portfolio-worthy hero image. Establish one unmistakable focal subject and a deliberate visual hierarchy. Use intentional composition, believable perspective, rich but controlled color, nuanced lighting, dimensional depth, tactile material detail, and crisp subject separation. Make fine details coherent and purposeful; avoid visual clutter, accidental text, malformed anatomy, duplicate objects, plastic-looking textures, and oversharpening. Treat the user prompt as a specification, not loose inspiration. Preserve the exact requested subject identity, number of subjects and objects, defining attributes, left/right placement, pose, setting, materials, palette, and framing. Resolve conflicts in favor of the user's explicit requirements; never replace a named subject with a visually similar generic subject. Interpret the request in the language it was written in; preserve proper names and any exact visible wording, and never invent text. Do not add logos, words, or extra objects unless requested.", steps: 8, style: "none", quality: "masterpiece", aspectRatio: "1:1", width: 1024, height: 1024,
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


test("infers portrait, landscape, and widescreen framing from natural language", () => {
  assert.equal(inferImageAspectRatio("A vertical portrait of a dancer"), "3:4");
  assert.equal(inferImageAspectRatio("A landscape of the mountains"), "4:3");
  assert.equal(inferImageAspectRatio("A cinematic widescreen desert scene"), "16:9");
  assert.equal(inferImageAspectRatio("A beautiful flower"), "1:1");
});

test("explicit numeric aspect ratios outrank conflicting descriptive words", () => {
  assert.equal(inferImageAspectRatio("A wide landscape composition, exact ratio 4:3"), "4:3");
  assert.equal(inferImageAspectRatio("A portrait subject in a 16:9 frame"), "16:9");
  assert.equal(inferImageAspectRatio("A horizontal scene, exact ratio 3:4"), "3:4");
});

test("accepts explicit supported framing and rejects unsupported dimensions", () => {
  const portrait = parseImageGenerationInput({ prompt: "A dancer", aspectRatio: "3:4" });
  assert.equal(portrait.ok, true);
  assert.deepEqual([portrait.width, portrait.height], [768, 1024]);
  assert.equal(portrait.aspectRatio, "3:4");
  const wide = parseImageGenerationInput({ prompt: "A city", aspectRatio: "16:9" });
  assert.deepEqual([wide.width, wide.height], [1024, 576]);
  assert.equal(parseImageGenerationInput({ prompt: "A city", aspectRatio: "9:16" }).ok, false);
});


test("maps generated PNG, JPEG and WebP data URLs to matching file metadata", () => {
  assert.deepEqual(getGeneratedImageFileMetadata("data:image/png;base64,AAAA", "image/png"), { mimeType: "image/png", extension: "png" });
  assert.deepEqual(getGeneratedImageFileMetadata("data:image/jpeg;base64,AAAA", "image/jpeg"), { mimeType: "image/jpeg", extension: "jpg" });
  assert.deepEqual(getGeneratedImageFileMetadata("data:image/webp;base64,AAAA", "image/webp"), { mimeType: "image/webp", extension: "webp" });
  assert.equal(getGeneratedImageFileMetadata("data:image/webp;base64,AAAA", "image/jpeg"), null);
  assert.equal(getGeneratedImageFileMetadata("https://example.test/image.png", "image/png"), null);
});


test("infers image framing from Kannada and Hindi prompts", () => {
  assert.equal(inferImageAspectRatio("ಲಂಬ ಚಿತ್ರದಲ್ಲಿ ಒಂದು ಹೂವು"), "3:4");
  assert.equal(inferImageAspectRatio("ಅಡ್ಡ ಚಿತ್ರದಲ್ಲಿ ಪರ್ವತಗಳು"), "4:3");
  assert.equal(inferImageAspectRatio("ವೈಡ್‌ಸ್ಕ್ರೀನ್ ಸಿನೆಮಾಟಿಕ್ ದೃಶ್ಯ"), "16:9");
  assert.equal(inferImageAspectRatio("ऊर्ध्वाधर चित्र में एक फूल"), "3:4");
  assert.equal(inferImageAspectRatio("क्षैतिज दृश्य में पहाड़"), "4:3");
  assert.equal(inferImageAspectRatio("वाइडस्क्रीन सिनेमाई दृश्य"), "16:9");
});


test("image edits preserve reference identity and change only the requested details", () => {
  const prompt = buildImageEditPrompt(
    "A woman with short curly hair, round glasses, a blue jacket, standing beside a red bicycle",
    "Replace only the background with a quiet Kyoto street at dawn",
  );
  assert.match(prompt, /Original image brief: A woman with short curly hair/);
  assert.match(prompt, /Requested refinement: Replace only the background/);
  assert.match(prompt, /Preserve the exact main subject, identity, face, anatomy, pose, clothing/);
  assert.match(prompt, /Make only the requested refinement/);
  assert.match(prompt, /Do not replace, reinterpret, or redesign the subject/);
});

test("image edit prompt builder rejects an empty refinement and bounds copied source brief", () => {
  assert.equal(buildImageEditPrompt("Original image", "  "), null);
  const prompt = buildImageEditPrompt("x".repeat(1400), "Change only the lighting");
  assert.ok(prompt.length < 3000);
  assert.match(prompt, /x{1200}/);
  assert.doesNotMatch(prompt, /x{1201}/);
});
