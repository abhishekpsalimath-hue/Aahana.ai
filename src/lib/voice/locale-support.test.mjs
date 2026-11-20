import test from "node:test";
import assert from "node:assert/strict";
import { getSpeechLocaleSupport, getCommonSpeechLocales } from "./locale-support.mjs";

const capabilities = {
  recognition: { enabled: true, supportedLocales: ["en-IN", "kn-IN", "hi-IN"] },
  synthesis: { enabled: true, supportedLocales: ["en-IN", "hi-IN", "fr-FR"] },
};

test("reports full speech support only when both directions list the locale", () => {
  assert.deepEqual(getSpeechLocaleSupport(capabilities, "en-in"), {
    locale: "en-IN", recognition: true, synthesis: true, fullDuplex: true, status: "ready",
  });
});

test("distinguishes recognition-only and synthesis-only locales", () => {
  assert.equal(getSpeechLocaleSupport(capabilities, "kn-IN").status, "recognition-only");
  assert.equal(getSpeechLocaleSupport(capabilities, "fr-FR").status, "synthesis-only");
});

test("does not report unconfigured locales as supported", () => {
  assert.equal(getSpeechLocaleSupport(capabilities, "ta-IN").status, "unsupported");
});

test("disabled providers do not report supported capability", () => {
  const disabled = {
    recognition: { enabled: false, supportedLocales: ["en-IN"] },
    synthesis: { enabled: true, supportedLocales: ["en-IN"] },
  };
  assert.equal(getSpeechLocaleSupport(disabled, "en-IN").status, "synthesis-only");
});

test("returns only canonical locales supported in both directions", () => {
  assert.deepEqual(getCommonSpeechLocales({
    recognition: { supportedLocales: ["en-in", "kn-IN", "invalid_locale"] },
    synthesis: { supportedLocales: ["en-IN", "fr-FR"] },
  }), ["en-IN"]);
});

test("returns no common locales when one provider is absent", () => {
  assert.deepEqual(getCommonSpeechLocales({ recognition: { supportedLocales: ["en-IN"] } }), []);
});

test("rejects malformed locale queries", () => {
  assert.throws(() => getSpeechLocaleSupport(capabilities, "bad_locale"), { code: "INVALID_LOCALE" });
});
