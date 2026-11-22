import test from "node:test";
import assert from "node:assert/strict";
import { isImageGenerationRequest, isImageEditRequest } from "./creative-intent.mjs";

test("recognizes concise sacred-subject image requests without the word image", () => {
  for (const prompt of [
    "Generate Lord Shiva",
    "Create a beautiful Lord Shiva with the crescent moon",
    "Draw Hanuman",
    "Make a detailed portrait of Lord Ganesha",
    "Please create Krishna",
  ]) assert.equal(isImageGenerationRequest(prompt), true, prompt);
});

test("recognizes explicit image creation requests", () => {
  assert.equal(isImageGenerationRequest("Create a cinematic image of a mountain temple"), true);
  assert.equal(isImageGenerationRequest("Please generate a portrait of my dog"), true);
});

test("does not route ordinary deity questions into image generation", () => {
  assert.equal(isImageGenerationRequest("Explain the story of Lord Shiva"), false);
  assert.equal(isImageGenerationRequest("What are Hanuman's qualities?"), false);
});

test("recognizes image refinement instructions", () => {
  for (const prompt of [
    "Make the background cinematic",
    "Make background cinematic",
    "Make the lighting more dramatic",
    "Change the sky to a starry night",
    "Remove the extra person",
    "Add a trident beside Shiva",
    "Make it more realistic",
  ]) assert.equal(isImageEditRequest(prompt), true, prompt);
});

test("does not mistake unrelated conversation for image editing", () => {
  assert.equal(isImageEditRequest("Help me change my career"), false);
  assert.equal(isImageEditRequest("Explain the background of this story"), false);
});
