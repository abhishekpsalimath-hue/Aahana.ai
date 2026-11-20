import test from "node:test";
import assert from "node:assert/strict";
import { encodeMonoPcm16Wav } from "./audio-wav.mjs";

test("encodes a valid mono PCM16 WAV header and payload", async () => {
  const wav = encodeMonoPcm16Wav(new Float32Array([-1, 0, 1]), 16000);
  assert.equal(wav.type, "audio/wav");
  const bytes = new Uint8Array(await wav.arrayBuffer());
  assert.equal(bytes.length, 50);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "RIFF");
  assert.equal(new TextDecoder().decode(bytes.slice(8, 12)), "WAVE");
  const view = new DataView(bytes.buffer);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 16000);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), 6);
  assert.equal(view.getInt16(44, true), -32768);
  assert.equal(view.getInt16(46, true), 0);
  assert.equal(view.getInt16(48, true), 32767);
});

test("rejects empty samples and invalid sample rates", () => {
  assert.throws(() => encodeMonoPcm16Wav(new Float32Array(), 16000), /non-empty/);
  assert.throws(() => encodeMonoPcm16Wav(new Float32Array([0]), 1000), /sample rate/);
});
