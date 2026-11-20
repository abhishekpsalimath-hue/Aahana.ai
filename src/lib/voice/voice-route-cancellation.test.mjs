import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const transcribe = readFileSync(new URL("../../app/api/voice/transcribe/route.js", import.meta.url), "utf8");
const speech = readFileSync(new URL("../../app/api/voice/speech/route.js", import.meta.url), "utf8");

test("voice routes propagate request cancellation and return 499 instead of provider failure", () => {
  for (const route of [transcribe, speech]) {
    assert.match(route, /signal: request\.signal/);
    assert.match(route, /request\.signal\.aborted \|\| error\?\.name === "AbortError"/);
    assert.match(route, /status: 499/);
  }
});
