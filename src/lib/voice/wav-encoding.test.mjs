import test from "node:test";
import assert from "node:assert/strict";
import { encodePcm16Wav, isPcm16Wav } from "./wav-encoding.mjs";

test("encodes mono PCM16 samples into a valid RIFF/WAVE container", () => {
  const wav = encodePcm16Wav([new Float32Array([-1, -0.5, 0, 0.5, 1])], 16000);
  assert.equal(isPcm16Wav(wav), true);
  const view = new DataView(wav);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 16000);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), 10);
  assert.equal(wav.byteLength, 54);
});

test("rejects invalid sample rates, empty audio, non-float chunks and oversized buffers", () => {
  assert.throws(() => encodePcm16Wav([], 16000), /empty/);
  assert.throws(() => encodePcm16Wav([new Float32Array([0])], 1000), /sample rate/);
  assert.throws(() => encodePcm16Wav([[0]], 16000), /sample data/);
  const huge = new Float32Array(8 * 1024 * 1024);
  assert.throws(() => encodePcm16Wav([huge], 16000), /15 MB/);
});
