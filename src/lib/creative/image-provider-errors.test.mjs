import test from "node:test";
import assert from "node:assert/strict";
import { classifyCloudflareImageFailure } from "./image-provider-errors.mjs";

test("identifies Cloudflare's known prompt safety-filter rejection without blaming the user", () => {
  const result = classifyCloudflareImageFailure(400, [{ code: 3030, message: "Input prompt contains NSFW content" }]);
  assert.equal(result.status, 422);
  assert.match(result.message, /automated safety filter/i);
  assert.match(result.message, /harmless anime/i);
  assert.equal(result.code, "3030");
});

test("normalizes string error codes and recognizes the safety message", () => {
  const result = classifyCloudflareImageFailure(400, [{ code: "3030", message: "input prompt contains nsfw content" }]);
  assert.equal(result.status, 422);
  assert.equal(result.code, "3030");
});

test("does not mislabel unrelated provider 400 responses as safety blocks", () => {
  const result = classifyCloudflareImageFailure(400, [{ code: 1001, message: "Invalid dimensions" }]);
  assert.equal(result.status, 422);
  assert.doesNotMatch(result.message, /safety filter/i);
  assert.match(result.message, /not necessarily mean your prompt/i);
});

test("preserves rate-limit and transient-service failure distinctions", () => {
  assert.equal(classifyCloudflareImageFailure(429).status, 429);
  assert.equal(classifyCloudflareImageFailure(503).status, 503);
});
