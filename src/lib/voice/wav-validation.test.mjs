import test from "node:test";
import assert from "node:assert/strict";
import { hasWavContainerHeader } from "./wav-validation.mjs";

test("accepts RIFF/WAVE container signatures", () => {
  assert.equal(hasWavContainerHeader(new Uint8Array([82,73,70,70,0,0,0,0,87,65,86,69])), true);
});

test("rejects non-WAVE, truncated and non-byte inputs", () => {
  assert.equal(hasWavContainerHeader(new Uint8Array([82,73,70,70,0,0,0,0,65,86,73,32])), false);
  assert.equal(hasWavContainerHeader(new Uint8Array([82,73,70,70,0,0,0,0,87,65,86])), false);
  assert.equal(hasWavContainerHeader("RIFF----WAVE"), false);
});
