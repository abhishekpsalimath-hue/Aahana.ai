import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../../app/experience-lab/page.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../app/experience-lab/experience-lab.css", import.meta.url), "utf8");
const speechRoute = readFileSync(new URL("../../app/api/voice/speech/route.js", import.meta.url), "utf8");

test("Experience Lab provides browser voice input with a selectable locale", () => {
  assert.match(page, /window\.SpeechRecognition \|\| window\.webkitSpeechRecognition/);
  assert.match(page, /recognition\.lang = voiceLocale/);
  assert.match(page, /setPrompt\(\(current\) => current \? current \+ " " \+ transcript\.trim\(\) : transcript\.trim\(\)\)/);
  for (const locale of ["en-IN", "kn-IN", "hi-IN", "ta-IN", "te-IN", "ml-IN"]) {
    assert.match(page, new RegExp(locale));
  }
});

test("Experience Lab provides interruptible device speech playback and cleanup", () => {
  assert.match(page, /new SpeechSynthesisUtterance/);
  assert.match(page, /window\.speechSynthesis\.cancel\(\)/);
  assert.match(page, /recognitionRef\.current\?\.stop/);
  assert.match(page, /window\.speechSynthesis\?\.cancel\?\.\(\)/);
  assert.match(page, /aria-live="polite"/);
});

test("voice panel discloses local browser processing and has responsive interaction styling", () => {
  assert.match(page, /Aahana does not directly upload or store a raw recording/);
  assert.match(page, /browser&apos;s speech service may process audio under its own privacy terms/);
  assert.match(styles, /\.voice-panel-action/);
  assert.match(styles, /\.voice-panel-status/);
  assert.match(styles, /\.voice-panel-error/);
});

test("Experience Lab prefers private Maya speech and safely falls back to device voice", () => {
  assert.match(page, /api\/voice\/speech/);
  assert.match(page, /shouldFallbackToDeviceSpeech/);
  assert.match(page, /speechRequestRef\.current\?\.abort/);
  assert.match(page, /audioPlaybackRef\.current\?\.pause/);
  assert.match(speechRoute, /supabase\.auth\.getUser/);
  assert.match(speechRoute, /AAHANA_MAYA_TTS_ENABLED/);
  assert.match(speechRoute, /signal: request\.signal/);
});


test("Create mode exposes bounded video settings and passes them to the video route", () => {
  assert.match(page, /const \[videoDuration, setVideoDuration\] = useState\(5\)/);
  assert.match(page, /const \[videoResolution, setVideoResolution\] = useState\("hd"\)/);
  assert.match(page, /const \[videoAspectRatio, setVideoAspectRatio\] = useState\("16:9"\)/);
  assert.match(page, /const \[videoAudio, setVideoAudio\] = useState\(true\)/);
  assert.match(page, /duration: videoDuration, resolution: videoResolution, aspectRatio: videoAspectRatio, generateAudio: videoAudio/);
  for (const value of ["5", "10", "15", "20", "hd", "fhd", "16:9", "9:16", "1:1"]) assert.ok(page.includes(`value={${value}}`) || page.includes(`value="${value}"`), `missing option ${value}`);
});
