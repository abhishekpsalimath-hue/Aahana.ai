import test from "node:test";
import assert from "node:assert/strict";
import { isImageEditRequest, isImageGenerationRequest } from "./image-intent-policy.mjs";

test("recognizes direct image requests in everyday language", () => {
  for (const prompt of [
    "Create an image of a futuristic city at night",
    "I want a picture of a golden retriever",
    "Make me a logo for my coffee shop",
    "Can you generate a poster for a school science fair?",
    "Please make a beautiful wallpaper",
    "Show me an illustration of the water cycle",
  ]) assert.equal(isImageGenerationRequest(prompt), true, prompt);
});

test("recognizes simple draw, sketch and paint requests without the word image", () => {
  for (const prompt of [
    "Draw a cat sitting on a windowsill",
    "Sketch me a small modern house",
    "Paint a sunset over the ocean",
    "Illustrate a friendly robot",
  ]) assert.equal(isImageGenerationRequest(prompt), true, prompt);
});

test("does not route ordinary writing and reasoning requests to image generation", () => {
  for (const prompt of [
    "Explain how photosynthesis works",
    "Make a study plan for my exams",
    "Draw a conclusion from this report",
    "Create a business plan for a bakery",
    "Help me compare these two job offers",
    "Write a short story about a cat",
  ]) assert.equal(isImageGenerationRequest(prompt), false, prompt);
});

test("recognizes detailed visual prompts pasted without an explicit command", () => {
  assert.equal(isImageGenerationRequest("A photorealistic cinematic wide-shot of a futuristic city, neon lighting, realistic reflections, dramatic lighting, 8k high-detail architecture."), true);
});

test("rejects empty and excessively long prompts", () => {
  assert.equal(isImageGenerationRequest("   "), false);
  assert.equal(isImageGenerationRequest("a".repeat(8001)), false);
});

test("recognizes natural-language image editing requests when an image is attached", () => {
  for (const prompt of [
    "Remove the background",
    "Change the dress colour to blue",
    "Make it brighter and add warm lighting",
    "Replace the sky with a sunset",
    "Remove the text from this image",
    "Turn it into a watercolour painting",
    "Background hatao",
    "Background remove maadi",
    "Colour blue maadi",
    "Sky change karo",
  ]) assert.equal(isImageEditRequest(prompt), true, prompt);
});

test("does not mistake unrelated chat for image editing", () => {
  for (const prompt of [
    "Explain how to edit a photograph",
    "Change my study plan",
    "Add these numbers",
    "What is the background of this story?",
    "Make it more understandable",
  ]) assert.equal(isImageEditRequest(prompt), false, prompt);
});
