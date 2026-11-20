import test from "node:test";
import assert from "node:assert/strict";
import { createMayaTtsProvider, MAYA_LANGUAGE_CODES } from "./maya-tts-provider.mjs";

function mockResponse(bytes = [82, 73, 70, 70]) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => "audio/wav" },
    async arrayBuffer() { return Uint8Array.from(bytes).buffer; },
  };
}

test("maps supported BCP 47 locales to Maya language codes", () => {
  assert.equal(MAYA_LANGUAGE_CODES["kn-IN"], "kn");
  assert.equal(MAYA_LANGUAGE_CODES["en-GB"], "en");
  assert.equal(MAYA_LANGUAGE_CODES["ta-IN"], "ta");
  assert.equal(MAYA_LANGUAGE_CODES["fr-FR"], undefined);
});

test("creates an inert provider when no private endpoint is configured", () => {
  const provider = createMayaTtsProvider({ fetchImpl: async () => mockResponse() });
  assert.equal(provider.isAvailable(), false);
});

test("rejects insecure non-loopback endpoints", () => {
  assert.throws(
    () => createMayaTtsProvider({ baseUrl: "http://speech.example.com", fetchImpl: async () => mockResponse() }),
    { code: "INSECURE_PROVIDER_ENDPOINT" },
  );
});

test("accepts HTTPS and loopback endpoints only", () => {
  assert.equal(createMayaTtsProvider({ baseUrl: "https://speech.example.com", fetchImpl: async () => mockResponse() }).isAvailable(), true);
  assert.equal(createMayaTtsProvider({ baseUrl: "http://127.0.0.1:8080", fetchImpl: async () => mockResponse() }).isAvailable(), true);
});

test("calls Maya's documented endpoint and returns audio bytes", async () => {
  let request;
  const provider = createMayaTtsProvider({
    baseUrl: "https://speech.example.com/",
    voice: "Vaidehi",
    authorizationToken: "proxy-secret",
    fetchImpl: async (url, options) => {
      request = { url: String(url), options };
      return mockResponse();
    },
  });
  const result = await provider.synthesize({ text: "ನಮಸ್ಕಾರ", locale: "kn-IN" });
  assert.equal(request.url, "https://speech.example.com/v1/audio/speech");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization, "Bearer proxy-secret");
  assert.deepEqual(JSON.parse(request.options.body), {
    input: "ನಮಸ್ಕಾರ", language: "kn", voice: "Vaidehi", response_format: "wav",
  });
  assert.equal(result.mimeType, "audio/wav");
  assert.deepEqual([...result.audio], [82, 73, 70, 70]);
});

test("propagates caller cancellation to the bounded inference signal", async () => {
  const controller = new AbortController();
  let receivedSignal;
  const provider = createMayaTtsProvider({
    baseUrl: "https://speech.example.com",
    fetchImpl: async (_url, options) => {
      receivedSignal = options.signal;
      return mockResponse();
    },
  });
  await provider.synthesize({ text: "hello", locale: "en-IN", signal: controller.signal });
  assert.notEqual(receivedSignal, controller.signal);
  controller.abort();
  assert.equal(receivedSignal.aborted, true);
});

test("rejects unsupported locales before making a network request", async () => {
  let called = false;
  const provider = createMayaTtsProvider({
    baseUrl: "https://speech.example.com",
    fetchImpl: async () => { called = true; return mockResponse(); },
  });
  await assert.rejects(provider.synthesize({ text: "hello", locale: "fr-FR" }), { code: "UNSUPPORTED_LOCALE" });
  assert.equal(called, false);
});

test("rejects non-audio and empty responses", async () => {
  const provider = createMayaTtsProvider({
    baseUrl: "https://speech.example.com",
    fetchImpl: async () => ({ ...mockResponse(), headers: { get: () => "application/json" } }),
  });
  await assert.rejects(provider.synthesize({ text: "hello", locale: "en-IN" }), { code: "INVALID_PROVIDER_RESPONSE" });
  const emptyProvider = createMayaTtsProvider({
    baseUrl: "https://speech.example.com",
    fetchImpl: async () => mockResponse([]),
  });
  await assert.rejects(emptyProvider.synthesize({ text: "hello", locale: "en-IN" }), { code: "EMPTY_AUDIO" });
});

test("rejects an invalid voice or oversized audio response", async () => {
  assert.throws(
    () => createMayaTtsProvider({ baseUrl: "https://speech.example.com", voice: "Unknown", fetchImpl: async () => mockResponse() }),
    { code: "INVALID_PROVIDER_CONFIG" },
  );
  const provider = createMayaTtsProvider({
    baseUrl: "https://speech.example.com",
    fetchImpl: async () => ({
      ok: true, status: 200,
      headers: { get: () => "audio/wav" },
      async arrayBuffer() { return new ArrayBuffer(20 * 1024 * 1024 + 1); },
    }),
  });
  await assert.rejects(provider.synthesize({ text: "hello", locale: "en-IN" }), { code: "AUDIO_TOO_LARGE" });
});

test("maps an upstream request deadline to PROVIDER_TIMEOUT", async () => {
  const provider = createMayaTtsProvider({
    baseUrl: "https://speech.example.com",
    timeoutMs: 5,
    fetchImpl: async (_url, { signal }) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (signal.aborted) throw signal.reason;
      return mockResponse();
    },
  });
  await assert.rejects(
    provider.synthesize({ text: "hello", locale: "en-IN" }),
    { code: "PROVIDER_TIMEOUT" },
  );
});
