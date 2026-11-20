import test from "node:test";
import assert from "node:assert/strict";
import { parseImageGenerationInput } from "./image-generation.mjs";

test("defaults to automatic masterpiece image direction without asking the user to choose settings", () => {
  assert.deepEqual(parseImageGenerationInput({ prompt: "A moonlit forest" }), {
    ok: true, prompt: "A moonlit forest\n\nCreative direction: produce a premium, portfolio-worthy hero image. Establish one unmistakable focal subject and a deliberate visual hierarchy. Use intentional composition, believable perspective, rich but controlled color, nuanced lighting, dimensional depth, tactile material detail, and crisp subject separation. Make fine details coherent and purposeful; avoid visual clutter, accidental text, malformed anatomy, duplicate objects, plastic-looking textures, and oversharpening. Preserve the subject and specific details requested by the user. Do not add logos, words, or extra objects unless requested.", steps: 8, style: "none", quality: "masterpiece",
  });
});

test("accepts explicit supported eight-step image generation", () => {
  assert.deepEqual(parseImageGenerationInput({ prompt: "A moonlit forest", steps: 8 }), {
    ok: true, prompt: "A moonlit forest", steps: 8, style: "none", quality: "standard",
  });
});

test("trims prompts and rejects empty or overlong prompts", () => {
  assert.equal(parseImageGenerationInput({ prompt: "  " }).ok, false);
  assert.equal(parseImageGenerationInput({ prompt: "x".repeat(2049) }).ok, false);
  assert.equal(parseImageGenerationInput({ prompt: "  a portrait  " }).prompt, "a portrait");
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

test("rejects unknown styles and styled prompts that exceed the provider limit", () => {
  assert.equal(parseImageGenerationInput({ prompt: "A portrait", style: "unknown" }).ok, false);
  assert.equal(parseImageGenerationInput({ prompt: "x".repeat(2000), style: "cinematic" }).ok, false);
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
