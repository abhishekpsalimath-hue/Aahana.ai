import test from "node:test";
import assert from "node:assert/strict";
import { isImageGenerationRequest, isImageEditRequest, isVideoGenerationRequest } from "./creative-intent.mjs";

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


test("recognizes direct natural-language video creation requests", () => {
  for (const prompt of [
    "Create a video of Lord Shiva meditating on Mount Kailash",
    "Generate a cinematic video of a mountain river",
    "Make a 10-second animation of a flower opening",
    "Produce a short film showing a rainy Bengaluru street",
    "Animate this image into a video",
    "Turn this photo into a video",
  ]) assert.equal(isVideoGenerationRequest(prompt), true, prompt);
});

test("does not route video questions or general explanations into generation", () => {
  for (const prompt of [
    "What is video generation?",
    "How do I make a video?",
    "Explain how animation works",
    "Can you recommend video editing software?",
  ]) assert.equal(isVideoGenerationRequest(prompt), false, prompt);
});

test("routes Kannada and Hindi sacred image requests directly to generation", () => {
  for (const prompt of [
    "ಶಿವನ ಚಿತ್ರ ರಚಿಸಿ",
    "ಆಂಜನೇಯ ಸ್ವಾಮಿಯ ಚಿತ್ರ ಬಿಡಿಸಿ",
    "ಗಣಪತಿಯ ಚಿತ್ರ ಮಾಡಿ",
    "ಶ್ರೀರಾಮನ ಚಿತ್ರ ಸೃಷ್ಟಿಸಿ",
    "महादेव का चित्र बनाओ",
    "हनुमान की तस्वीर बनाइए",
    "श्रीकृष्ण का चित्र बनाओ",
  ]) assert.equal(isImageGenerationRequest(prompt), true, prompt);
});

test("does not route localized sacred-subject questions into image generation", () => {
  assert.equal(isImageGenerationRequest("ಶಿವನ ಕಥೆ ಹೇಳಿ"), false);
  assert.equal(isImageGenerationRequest("हनुमान कौन हैं?"), false);
});
