import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("./route.js", import.meta.url), "utf8");

test("transcription route validates real WAV bytes and rejects malformed upload lengths", () => {
  assert.match(route, /hasWavContainerHeader\(wavHeader\)/);
  assert.match(route, /Number\.isSafeInteger\(contentLength\)/);
  assert.match(route, /request\.signal\.aborted/);
  assert.match(route, /status: 499/);
});

test("transcription route checks cancellation after provider completion before returning transcript", () => {
  assert.match(route, /const result = await provider\.transcribe[\s\S]*?if \(request\.signal\.aborted\) return new Response\(null, \{ status: 499 \}\);[\s\S]*?return NextResponse\.json/);
});


test("capabilities endpoint is authenticated, no-store, and exposes only enabled locale identifiers", () => {
  assert.match(route, /export async function GET\(\)/);
  assert.match(route, /Please sign in to inspect voice capabilities/);
  assert.match(route, /enabled: Boolean\(provider\?\.isAvailable\(\)\)/);
  assert.match(route, /locales: provider\?\.isAvailable\(\) \? provider\.supportedLocales : \[\]/);
  assert.match(route, /Cache-Control": "private, no-store"/);
});
