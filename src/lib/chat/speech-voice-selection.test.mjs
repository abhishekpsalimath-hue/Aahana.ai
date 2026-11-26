import test from "node:test";
import assert from "node:assert/strict";
import { selectSpeechVoice } from "./speech-voice-selection.mjs";

const voice = (name, lang, extra = {}) => ({ name, lang, ...extra });

test("prefers exact regional language over a local voice in a different region", () => {
  const regional = voice("US English", "en-US", { localService: true });
  const local = voice("UK English", "en-GB", { localService: true });
  assert.equal(selectSpeechVoice([local, regional], "en-US"), regional);
});

test("normalizes underscore locale tags and ranks same-language fallbacks", () => {
  const fallback = voice("Kannada", "kn_IN");
  assert.equal(selectSpeechVoice([fallback], "kn-IN"), fallback);
  const hindi = voice("Hindi", "hi-IN");
  assert.equal(selectSpeechVoice([hindi], "hi"), hindi);
});

test("uses local/default voice only as a tie-breaker within the requested language", () => {
  const remote = voice("Remote Hindi", "hi-IN");
  const local = voice("Local Hindi", "hi-IN", { localService: true });
  assert.equal(selectSpeechVoice([remote, local], "hi-IN"), local);
});

test("does not choose an unrelated voice or throw for absent voice lists", () => {
  assert.equal(selectSpeechVoice([voice("English", "en-US")], "kn-IN"), null);
  assert.equal(selectSpeechVoice([], "en-IN"), null);
  assert.equal(selectSpeechVoice(null, "en-IN"), null);
  assert.equal(selectSpeechVoice([voice("English", "en-US")], "not a locale"), null);
});

test("preserves browser ordering when otherwise equally ranked", () => {
  const first = voice("First Hindi", "hi-IN");
  const second = voice("Second Hindi", "hi-IN");
  assert.equal(selectSpeechVoice([first, second], "hi-IN"), first);
});
