import test from "node:test";
import assert from "node:assert/strict";
import {
  IMAGE_PROMPT_COMPILER_INSTRUCTIONS,
  selectCompiledImagePrompt,
} from "./image-prompt-compiler.mjs";

test("image prompt compiler preserves explicit constraints and exact text", () => {
  assert.match(IMAGE_PROMPT_COMPILER_INSTRUCTIONS, /Preserve the user's intended subject/);
  assert.match(IMAGE_PROMPT_COMPILER_INSTRUCTIONS, /spelling, punctuation, capitalization and language verbatim/);
  assert.match(IMAGE_PROMPT_COMPILER_INSTRUCTIONS, /Do not invent extra text/);
});

test("uses a useful compiled prompt and normalizes whitespace", () => {
  assert.equal(
    selectCompiledImagePrompt("  A cinematic portrait, centered, warm window light.  ", "Make a portrait"),
    "A cinematic portrait, centered, warm window light."
  );
});

test("falls back to the original when the compiler output is empty or invalid", () => {
  assert.equal(selectCompiledImagePrompt("", "A detailed city at night"), "A detailed city at night");
  assert.equal(selectCompiledImagePrompt("short", "A detailed city at night"), "A detailed city at night");
  assert.equal(selectCompiledImagePrompt("x".repeat(2049), "A detailed city at night"), "A detailed city at night");
  assert.equal(selectCompiledImagePrompt("Useful detailed image prompt", ""), "");
});
