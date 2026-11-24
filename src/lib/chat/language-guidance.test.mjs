import test from "node:test";
import assert from "node:assert/strict";
import { getLanguageGuidance, SUPPORTED_SCRIPT_LABELS } from "./language-guidance.mjs";

test("returns no extra instruction for empty text or ordinary Latin-script text", () => {
  assert.equal(getLanguageGuidance(""), "");
  assert.equal(getLanguageGuidance("Hello, can you help me?"), "");
  assert.equal(getLanguageGuidance(null), "");
});

test("recognizes Kannada and tells the assistant to preserve the user's language and script", () => {
  const guidance = getLanguageGuidance("ನಮಸ್ಕಾರ, ನನಗೆ ಸಹಾಯ ಮಾಡುತ್ತೀರಾ?");
  assert.match(guidance, /Kannada script/);
  assert.match(guidance, /preserve the script/);
  assert.match(guidance, /Do not transliterate/);
});

test("recognizes other Indian scripts without guessing a specific language", () => {
  assert.match(getLanguageGuidance("வணக்கம், எனக்கு உதவி செய்யுங்கள்"), /Tamil script/);
  assert.match(getLanguageGuidance("తెలుగు భాషలో సమాధానం ఇవ్వండి"), /Telugu script/);
  assert.match(getLanguageGuidance("मराठीमध्ये उत्तर द्या"), /Devanagari script/);
  assert.match(getLanguageGuidance("മലയാളത്തിൽ മറുപടി നൽകൂ"), /Malayalam script/);
});

test("recognizes international writing systems", () => {
  assert.match(getLanguageGuidance("안녕하세요, 도와주세요"), /Hangul script/);
  assert.match(getLanguageGuidance("こんにちは、手伝ってください"), /Hiragana script/);
  assert.match(getLanguageGuidance("مرحبا، ساعدني من فضلك"), /Arabic-derived script/);
});

test("handles mixed-script text and avoids overclaiming language identity", () => {
  const guidance = getLanguageGuidance("ನನಗೆ help ಬೇಕು");
  assert.match(guidance, /Kannada script/);
  assert.match(guidance, /assume a specific language solely/);
  assert.ok(SUPPORTED_SCRIPT_LABELS.includes("Gurmukhi"));
});
