import test from "node:test";
import assert from "node:assert/strict";
import { createSpeechRuntime, SpeechProviderError, normalizeLocale } from "./speech-runtime.mjs";

test("runtime starts disabled until providers are explicitly injected", () => {
  const runtime = createSpeechRuntime();
  assert.deepEqual(runtime.getCapabilities(), {
    recognition: { providerId: null, enabled: false, supportedLocales: [] },
    synthesis: { providerId: null, enabled: false, supportedLocales: [] },
  });
});

test("recognition delegates audio and canonical locale to the injected provider", async () => {
  let received;
  const runtime = createSpeechRuntime({
    recognitionProvider: {
      id: "mock-stt",
      supportedLocales: ["kn-IN"],
      async transcribe(input) { received = input; return { text: "ನಮಸ್ಕಾರ" }; },
    },
  });
  const result = await runtime.transcribe({ audio: "mock-audio", locale: "kn-in" });
  assert.equal(received.locale, "kn-IN");
  assert.equal(result.text, "ನಮಸ್ಕಾರ");
  assert.equal(result.providerId, "mock-stt");
});

test("synthesis delegates text and returns normalized audio metadata", async () => {
  let received;
  const runtime = createSpeechRuntime({
    synthesisProvider: {
      id: "mock-tts",
      supportedLocales: ["en-IN"],
      async synthesize(input) { received = input; return { audio: "mock-audio" }; },
    },
  });
  const result = await runtime.synthesize({ text: " Hello ", locale: "en-in" });
  assert.equal(received.text, "Hello");
  assert.equal(received.locale, "en-IN");
  assert.equal(result.mimeType, "audio/mpeg");
  assert.equal(result.providerId, "mock-tts");
});

test("does not invoke a provider for an unsupported locale", async () => {
  let called = false;
  const runtime = createSpeechRuntime({
    recognitionProvider: {
      id: "mock-stt",
      supportedLocales: ["en-IN"],
      async transcribe() { called = true; return { text: "hello" }; },
    },
  });
  await assert.rejects(
    runtime.transcribe({ audio: "audio", locale: "kn-IN" }),
    (error) => error instanceof SpeechProviderError && error.code === "UNSUPPORTED_LOCALE",
  );
  assert.equal(called, false);
});

test("fails closed when a provider is absent or unavailable", async () => {
  const empty = createSpeechRuntime();
  await assert.rejects(empty.transcribe({ audio: "audio", locale: "en-IN" }), { code: "PROVIDER_NOT_CONFIGURED" });
  const unavailable = createSpeechRuntime({
    synthesisProvider: {
      id: "disabled-tts",
      supportedLocales: ["en-IN"],
      isAvailable: () => false,
      async synthesize() { throw new Error("must not be called"); },
    },
  });
  await assert.rejects(unavailable.synthesize({ text: "hello", locale: "en-IN" }), { code: "PROVIDER_UNAVAILABLE" });
});

test("validates missing input and empty provider output", async () => {
  const runtime = createSpeechRuntime({
    recognitionProvider: { id: "stt", supportedLocales: ["en-IN"], async transcribe() { return { text: " " }; } },
    synthesisProvider: { id: "tts", supportedLocales: ["en-IN"], async synthesize() { return {}; } },
  });
  await assert.rejects(runtime.transcribe({ locale: "en-IN" }), { code: "AUDIO_REQUIRED" });
  await assert.rejects(runtime.transcribe({ audio: "x", locale: "en-IN" }), { code: "EMPTY_TRANSCRIPT" });
  await assert.rejects(runtime.synthesize({ text: " ", locale: "en-IN" }), { code: "TEXT_REQUIRED" });
  await assert.rejects(runtime.synthesize({ text: "hello", locale: "en-IN" }), { code: "EMPTY_AUDIO" });
});

test("canonicalizes valid locales and rejects malformed locales", () => {
  assert.equal(normalizeLocale("en-in"), "en-IN");
  assert.throws(() => normalizeLocale("not_a_locale"), { code: "INVALID_LOCALE" });
});
