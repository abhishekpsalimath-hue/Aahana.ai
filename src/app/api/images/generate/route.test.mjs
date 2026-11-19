import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("./route.js", import.meta.url), "utf8");

test("image generation propagates request cancellation to the provider fetch", () => {
  assert.match(route, /if \(request\.signal\.aborted\) return new Response\(null, \{ status: 499 \}\)/);
  assert.match(route, /AbortSignal\.any\(\[request\.signal, AbortSignal\.timeout\(55000\)\]\)/);
});

test("image generation distinguishes caller cancellation from provider timeout", () => {
  assert.match(route, /catch \(error\) \{\s*if \(request\.signal\.aborted\) return new Response\(null, \{ status: 499 \}\);/);
  assert.match(route, /Image generation timed out or the provider is unavailable/);
});
