import test from "node:test";
import assert from "node:assert/strict";
import { hasPcm16MonoWavHeader } from "./wav-validation.mjs";

function validWav() {
  const bytes = new Uint8Array(46);
  const view = new DataView(bytes.buffer);
  const tag = (offset, value) => [...value].forEach((character, index) => { bytes[offset + index] = character.charCodeAt(0); });
  tag(0, "RIFF"); view.setUint32(4, 38, true); tag(8, "WAVE");
  tag(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  tag(36, "data"); view.setUint32(40, 2, true);
  return bytes;
}

test("accepts a structurally valid mono PCM16 RIFF/WAVE file", () => {
  const wav = validWav();
  assert.equal(hasPcm16MonoWavHeader(wav.subarray(0, 44), wav.byteLength), true);
});

test("rejects truncated, non-WAVE, non-PCM, stereo, mismatched and empty WAV payloads", () => {
  const wav = validWav();
  assert.equal(hasPcm16MonoWavHeader(wav.subarray(0, 12), wav.byteLength), false);
  const badFormat = validWav(); new DataView(badFormat.buffer).setUint16(20, 3, true);
  assert.equal(hasPcm16MonoWavHeader(badFormat, badFormat.byteLength), false);
  const stereo = validWav(); new DataView(stereo.buffer).setUint16(22, 2, true);
  assert.equal(hasPcm16MonoWavHeader(stereo, stereo.byteLength), false);
  assert.equal(hasPcm16MonoWavHeader(wav.subarray(0, 44), wav.byteLength + 2), false);
  const empty = validWav(); new DataView(empty.buffer).setUint32(40, 0, true);
  assert.equal(hasPcm16MonoWavHeader(empty, empty.byteLength), false);
});
