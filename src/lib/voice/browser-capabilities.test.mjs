import test from "node:test";
import assert from "node:assert/strict";
import {
  findBestSpeechVoice,
  getBrowserVoiceCapabilities,
} from "./browser-capabilities.js";

const voices = [
  { name: "English India", lang: "en-IN" },
  { name: "Kannada", lang: "kn-IN" },
  { name: "French France", lang: "fr-FR" },
];

test("selects an exact locale voice before a language fallback", () => {
  const candidates = [
    { name: "English US", lang: "en-US" },
    { name: "English India", lang: "en-IN" },
  ];
  assert.equal(findBestSpeechVoice(candidates, "en-IN").name, "English India");
});

test("falls back only within the requested language", () => {
  assert.equal(findBestSpeechVoice(voices, "fr-CA").name, "French France");
  assert.equal(findBestSpeechVoice(voices, "de-DE"), null);
});

test("returns no voice for an empty locale or invalid voice collection", () => {
  assert.equal(findBestSpeechVoice(voices, ""), null);
  assert.equal(findBestSpeechVoice(null, "en-IN"), null);
});

test("reports browser API availability separately from installed output locales", () => {
  const result = getBrowserVoiceCapabilities({
    recognitionAvailable: true,
    synthesisAvailable: true,
    voices,
  });
  assert.equal(result.inputAvailable, true);
  assert.equal(result.outputAvailable, true);
  assert.equal(result.hasInstalledOutputVoice, true);
  assert.deepEqual(result.installedOutputLocales, ["en-IN", "fr-FR", "kn-IN"]);
});

test("does not claim output support when no device voices are installed", () => {
  const result = getBrowserVoiceCapabilities({
    recognitionAvailable: true,
    synthesisAvailable: true,
    voices: [],
  });
  assert.equal(result.inputAvailable, true);
  assert.equal(result.outputAvailable, true);
  assert.equal(result.hasInstalledOutputVoice, false);
  assert.deepEqual(result.installedOutputLocales, []);
});

test("handles unavailable browser APIs", () => {
  const result = getBrowserVoiceCapabilities();
  assert.equal(result.inputAvailable, false);
  assert.equal(result.outputAvailable, false);
  assert.equal(result.hasInstalledOutputVoice, false);
});
