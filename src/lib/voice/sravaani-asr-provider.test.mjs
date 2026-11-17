import test from "node:test";
import assert from "node:assert/strict";
import { createSraVaaniAsrProvider } from "./sravaani-asr-provider.server.mjs";

const token = "private-test-token-" + "x".repeat(32);
const locale = ["kn-IN"];

function wavBytes() {
  return new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69]);
}

function response(payload, { status = 200, contentType = "application/json" } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => name.toLowerCase() === "content-type" ? contentType : null },
    json: async () => payload,
  };
}

test("provider is inert without a private endpoint", () => {
  const provider = createSraVaaniAsrProvider({ supportedLocales: locale });
  assert.equal(provider.isAvailable(), false);
  assert.deepEqual(provider.supportedLocales, locale);
});

test("rejects public HTTP endpoints", () => {
  assert.throws(
    () => createSraVaaniAsrProvider({
      baseUrl: "http://asr.example.com",
      authorizationToken: token,
      supportedLocales: locale,
    }),
    { code: "INSECURE_PROVIDER_ENDPOINT" },
  );
});

test("requires explicit locale allow-list", () => {
  assert.throws(
    () => createSraVaaniAsrProvider({ baseUrl: "https://asr.example.com", authorizationToken: token }),
    { code: "INVALID_PROVIDER_CONFIG" },
  );
});

test("posts WAV as multipart with bearer token and returns transcript", async () => {
  let request;
  const provider = createSraVaaniAsrProvider({
    baseUrl: "https://asr.example.com",
    authorizationToken: token,
    supportedLocales: locale,
    fetchImpl: async (url, options) => {
      request = { url: String(url), options };
      return response({ text: "ನಮಸ್ಕಾರ", provider: "sravaani-1.0" });
    },
  });

  const result = await provider.transcribe({ audio: wavBytes(), locale: "kn-IN" });
  assert.equal(result.text, "ನಮಸ್ಕಾರ");
  assert.equal(result.locale, "kn-IN");
  assert.equal(request.url, "https://asr.example.com/v1/audio/transcriptions");
  assert.equal(request.options.headers.Authorization, `Bearer ${token}`);
  assert.equal(request.options.body instanceof FormData, true);
  assert.equal(request.options.body.get("file").type, "audio/wav");
});

test("rejects locales not explicitly enabled", async () => {
  const provider = createSraVaaniAsrProvider({
    baseUrl: "https://asr.example.com",
    authorizationToken: token,
    supportedLocales: locale,
    fetchImpl: async () => response({ text: "ignored" }),
  });
  await assert.rejects(
    provider.transcribe({ audio: wavBytes(), locale: "hi-IN" }),
    { code: "UNSUPPORTED_LOCALE" },
  );
});

test("rejects invalid audio before network access", async () => {
  let called = false;
  const provider = createSraVaaniAsrProvider({
    baseUrl: "https://asr.example.com",
    authorizationToken: token,
    supportedLocales: locale,
    fetchImpl: async () => { called = true; return response({ text: "x" }); },
  });
  await assert.rejects(
    provider.transcribe({ audio: new Uint8Array(), locale: "kn-IN" }),
    { code: "INVALID_AUDIO_SIZE" },
  );
  assert.equal(called, false);
});

test("rejects malformed provider responses", async () => {
  const provider = createSraVaaniAsrProvider({
    baseUrl: "https://asr.example.com",
    authorizationToken: token,
    supportedLocales: locale,
    fetchImpl: async () => response({ text: " " }),
  });
  await assert.rejects(
    provider.transcribe({ audio: wavBytes(), locale: "kn-IN" }),
    { code: "EMPTY_TRANSCRIPT" },
  );
});
