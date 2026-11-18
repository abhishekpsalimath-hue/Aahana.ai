import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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


test("image and video generation can run independently without overwriting each other's status messages", () => {
  const workspace = readFileSync(new URL("../../app/assistant-workspace.jsx", import.meta.url), "utf8");
  const videoStart = workspace.indexOf("async function generateVideo");
  const imageStart = workspace.indexOf("async function generateImage", videoStart);
  const submitStart = workspace.indexOf("async function submitPrompt");
  const videoHandler = workspace.slice(videoStart, imageStart);
  const submitHandler = workspace.slice(submitStart, workspace.indexOf("return (", submitStart));

  assert.doesNotMatch(videoHandler, /imageGenerating/);
  assert.match(videoHandler, /mediaRequestId/);
  assert.match(videoHandler, /item\.mediaRequestId === mediaRequestId/);
  assert.match(submitHandler, /if \(imageGenerating \|\| videoGenerating\) return;/);
  assert.match(submitHandler, /item\.mediaRequestId === mediaRequestId/);
  assert.match(workspace, /disabled=\{!prompt\.trim\(\) \|\| imageGenerating \|\| busy \|\| Boolean\(imageFile\)\}/);
  assert.match(workspace, /disabled=\{!prompt\.trim\(\) \|\| videoGenerating \|\| busy \|\| Boolean\(imageFile\)\}/);
});
