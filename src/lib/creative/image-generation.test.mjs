import test from "node:test";
import assert from "node:assert/strict";
import { parseImageGenerationInput } from "./image-generation.mjs";

test("defaults image generation to the existing standard four-step mode", () => {
  assert.deepEqual(parseImageGenerationInput({ prompt: "A moonlit forest" }), {
    ok: true, prompt: "A moonlit forest", steps: 4, style: "none",
  });
});

test("accepts enhanced eight-step image generation", () => {
  assert.deepEqual(parseImageGenerationInput({ prompt: "A moonlit forest", steps: 8 }), {
    ok: true, prompt: "A moonlit forest", steps: 8, style: "none",
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

test("rejects unknown styles and styled prompts that exceed the provider limit", () => {
  assert.equal(parseImageGenerationInput({ prompt: "A portrait", style: "unknown" }).ok, false);
  assert.equal(parseImageGenerationInput({ prompt: "x".repeat(2000), style: "cinematic" }).ok, false);
});
