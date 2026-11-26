import test from "node:test";
import assert from "node:assert/strict";
import { inferSpeechLanguage } from "./speech-language.mjs";

test("detects major Indian scripts without a manual language choice", () => {
  assert.equal(inferSpeechLanguage("ನಮಸ್ಕಾರ, ನೀವು ಹೇಗಿದ್ದೀರಿ?"), "kn-IN");
  assert.equal(inferSpeechLanguage("வணக்கம்"), "ta-IN");
  assert.equal(inferSpeechLanguage("నమస్కారం"), "te-IN");
  assert.equal(inferSpeechLanguage("नमस्ते"), "hi-IN");
  assert.equal(inferSpeechLanguage("നമസ്കാരം"), "ml-IN");
  assert.equal(inferSpeechLanguage("স্বাগতম"), "bn-IN");
});

test("detects common international writing systems", () => {
  assert.equal(inferSpeechLanguage("こんにちは"), "ja-JP");
  assert.equal(inferSpeechLanguage("안녕하세요"), "ko-KR");
  assert.equal(inferSpeechLanguage("你好"), "zh-CN");
  assert.equal(inferSpeechLanguage("Привет"), "ru-RU");
  assert.equal(inferSpeechLanguage("مرحبا"), "ar-SA");
  assert.equal(inferSpeechLanguage("שלום"), "he-IL");
  assert.equal(inferSpeechLanguage("สวัสดี"), "th-TH");
});

test("uses language-specific Latin-script hints where detectable", () => {
  assert.equal(inferSpeechLanguage("Xin chào, cảm ơn bạn"), "vi-VN");
  assert.equal(inferSpeechLanguage("¡Buenos días!"), "es-ES");
  assert.equal(inferSpeechLanguage("Guten Morgen, Grüße"), "de-DE");
  assert.equal(inferSpeechLanguage("Bonjour, très bien"), "fr-FR");
  assert.equal(inferSpeechLanguage("Olá, coração"), "pt-BR");
  assert.equal(inferSpeechLanguage("İyi günler"), "tr-TR");
});

test("uses a validated device locale when script detection is inconclusive", () => {
  assert.equal(inferSpeechLanguage("Hello there", "en-GB"), "en-GB");
  assert.equal(inferSpeechLanguage("Ciao", "it-IT"), "it-IT");
  assert.equal(inferSpeechLanguage("Hello", "not a locale"), "en-IN");
  assert.equal(inferSpeechLanguage(null, "kn-IN"), "kn-IN");
});
