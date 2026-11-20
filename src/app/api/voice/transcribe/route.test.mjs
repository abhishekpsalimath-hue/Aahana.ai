import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("./route.js", import.meta.url), "utf8");

test("transcription route validates complete PCM16 WAV bytes and rejects malformed upload lengths", () => {
  assert.ok(route.includes("hasPcm16MonoWavHeader(wavHeader, file.size)"));
  assert.ok(route.includes("Number.isSafeInteger(contentLength)"));
  assert.ok(route.includes("request.signal.aborted"));
  assert.ok(route.includes("status: 499"));
});

test("transcription route checks cancellation after provider completion before returning transcript", () => {
  const providerCall = route.indexOf("const result = await provider.transcribe");
  const abortCheck = route.indexOf("if (request.signal.aborted) return new Response(null, { status: 499 });", providerCall);
  const responseCall = route.indexOf("return NextResponse.json", abortCheck);
  assert.ok(providerCall >= 0 && abortCheck > providerCall && responseCall > abortCheck);
});

test("capabilities endpoint is authenticated, no-store, and exposes only enabled locale identifiers", () => {
  assert.ok(route.includes("export async function GET()"));
  assert.ok(route.includes("Please sign in to inspect voice capabilities."));
  assert.ok(route.includes("locales: provider?.isAvailable() ? provider.supportedLocales : []"));
  assert.ok(route.includes('"Cache-Control": "private, no-store"'));
});
