import test from "node:test";
import assert from "node:assert/strict";
import {
  isVideoGenerationRequest,
  validateVideoGenerationInput,
  isTrustedGeneratedVideoUrl,
} from "./video-generation-policy.mjs";

test("recognises natural language video requests", () => {
  for (const prompt of [
    "Generate a cinematic video of a tiger running through a forest",
    "Create a 10 second animated video about space",
    "Make a short film of a rainy Bengaluru street",
    "Animate this and bring it to life",
    "ಈ ವಿಷಯದ ಬಗ್ಗೆ ವಿಡಿಯೋ ಮಾಡಿ",
    "Ek chhota video banao",
  ]) assert.equal(isVideoGenerationRequest(prompt), true, prompt);
});

test("does not mistake video discussion for generation", () => {
  for (const prompt of [
    "Explain how video generation works",
    "Write a script for a video about science",
    "Give me ideas for a short film",
    "What is frame rate?",
  ]) assert.equal(isVideoGenerationRequest(prompt), false, prompt);
});

test("validates bounded generation settings", () => {
  assert.deepEqual(validateVideoGenerationInput({ prompt: "A calm ocean", duration: 10 }), {
    prompt: "A calm ocean", duration: 10, resolution: "hd", generateAudio: true,
  });
  assert.throws(() => validateVideoGenerationInput({ prompt: "", duration: 5 }));
  assert.throws(() => validateVideoGenerationInput({ prompt: "A", duration: 2 }));
  assert.throws(() => validateVideoGenerationInput({ prompt: "A", duration: 30 }));
  assert.throws(() => validateVideoGenerationInput({ prompt: "A", resolution: "4k" }));
});

test("accepts only HTTPS Cloudflare video result URLs", () => {
  assert.equal(isTrustedGeneratedVideoUrl("https://examples.aig.cloudflare.com/video.mp4"), true);
  assert.equal(isTrustedGeneratedVideoUrl("http://examples.aig.cloudflare.com/video.mp4"), false);
  assert.equal(isTrustedGeneratedVideoUrl("https://evil.example/video.mp4"), false);
  assert.equal(isTrustedGeneratedVideoUrl("not-a-url"), false);
});
