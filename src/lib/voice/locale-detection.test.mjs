import test from "node:test";
import assert from "node:assert/strict";
import { detectSpeechLanguage, inferSpeechLocale } from "./locale-detection.mjs";

test("detects major Indian regional scripts", () => {
  assert.equal(inferSpeechLocale("ನಮಸ್ಕಾರ"), "kn-IN");
  assert.equal(inferSpeechLocale("வணக்கம்"), "ta-IN");
  assert.equal(inferSpeechLocale("హలో"), "te-IN");
  assert.equal(inferSpeechLocale("নমস্কার"), "bn-IN");
  assert.equal(inferSpeechLocale("ગુજરાતી"), "gu-IN");
  assert.equal(inferSpeechLocale("ਸਤ ਸ੍ਰੀ ਅਕਾਲ"), "pa-IN");
});

test("preserves selected locale for scripts shared by multiple languages", () => {
  assert.equal(inferSpeechLocale("नमस्ते", "mr-IN"), "mr-IN");
  assert.equal(inferSpeechLocale("নমস্কাৰ", "as-IN"), "as-IN");
  assert.equal(inferSpeechLocale("مرحبا", "ur-IN"), "ur-IN");
  assert.equal(inferSpeechLocale("你好", "zh-TW"), "zh-TW");
  assert.equal(inferSpeechLocale("Привет", "uk-UA"), "uk-UA");
});

test("recognizes additional international writing systems", () => {
  assert.equal(inferSpeechLocale("こんにちは"), "ja-JP");
  assert.equal(inferSpeechLocale("안녕하세요"), "ko-KR");
  assert.equal(inferSpeechLocale("שלום"), "he-IL");
  assert.equal(inferSpeechLocale("สวัสดี"), "th-TH");
  assert.equal(inferSpeechLocale("გამარჯობა"), "ka-GE");
  assert.equal(inferSpeechLocale("Բարեւ"), "hy-AM");
  assert.equal(inferSpeechLocale("မင်္ဂလာပါ"), "my-MM");
  assert.equal(inferSpeechLocale("ສະບາຍດີ"), "lo-LA");
  assert.equal(inferSpeechLocale("ជំរាបសួរ"), "km-KH");
});

test("keeps the preferred locale for Latin text and empty text", () => {
  assert.equal(inferSpeechLocale("Hello there", "en-GB"), "en-GB");
  assert.equal(inferSpeechLocale("", "fr-FR"), "fr-FR");
});

test("profiles mixed Kannada-English text and selects its dominant script", () => {
  const result = detectSpeechLanguage("ನಮಸ್ಕಾರ, how are you? ಚೆನ್ನಾಗಿದ್ದೀರಾ", "en-IN");
  assert.equal(result.locale, "kn-IN");
  assert.equal(result.isMixed, true);
  assert.equal(result.script, "kannada");
  assert.ok(result.confidence > 0 && result.confidence <= 1);
  assert.equal(result.reason, "dominant-script-in-mixed-text");
  assert.ok(result.scriptCounts.latin > 0);
  assert.ok(result.scriptCounts.kannada > 0);
});

test("keeps selected language for Latin-only mixed-language text", () => {
  const result = detectSpeechLanguage("Hello, namaskara, hegiddira?", "kn-IN");
  assert.equal(result.locale, "kn-IN");
  assert.equal(result.script, "latin");
  assert.equal(result.isMixed, false);
  assert.equal(result.reason, "latin-script-preserves-preference");
});

test("reports ties between different writing systems instead of claiming certainty", () => {
  const result = detectSpeechLanguage("ಕನ್ನಡ abcde", "kn-IN");
  assert.equal(result.locale, "kn-IN");
  assert.equal(result.isMixed, true);
  assert.equal(result.reason, "mixed-script-tie");
  assert.ok(result.confidence < 0.6);
});
