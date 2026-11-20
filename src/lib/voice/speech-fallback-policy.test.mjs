import test from "node:test";
import assert from "node:assert/strict";
import { shouldFallbackToDeviceSpeech } from "./speech-fallback-policy.mjs";

test("falls back to an installed device voice when private speech is unavailable", () => {
  for (const status of [400, 404, 408, 429, 500, 502, 503, 504]) {
    assert.equal(shouldFallbackToDeviceSpeech(status), true, `HTTP ${status}`);
  }
});

test("does not hide authentication or request-size failures behind device fallback", () => {
  for (const status of [401, 403, 413]) {
    assert.equal(shouldFallbackToDeviceSpeech(status), false, `HTTP ${status}`);
  }
});
