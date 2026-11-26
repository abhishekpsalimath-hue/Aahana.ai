import test from "node:test";
import assert from "node:assert/strict";
import { readBoundedJson } from "./bounded-json-response.mjs";

test("parses valid JSON within the byte limit", async () => {
  const response = new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  assert.deepEqual(await readBoundedJson(response, { maxBytes: 100 }), { ok: true });
});

test("rejects declared oversized bodies before reading", async () => {
  const response = new Response("{}", { headers: { "content-length": "200" } });
  await assert.rejects(readBoundedJson(response, { maxBytes: 100 }), /safe size limit/);
});

test("cancels chunked streams once they exceed the byte limit", async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode("x".repeat(101))); },
    cancel() { cancelled = true; },
  }));
  await assert.rejects(readBoundedJson(response, { maxBytes: 100 }), /safe size limit/);
  assert.equal(cancelled, true);
});

test("rejects invalid UTF-8 and invalid JSON", async () => {
  const invalidUtf8 = new Response(new Uint8Array([0xc3, 0x28]));
  await assert.rejects(readBoundedJson(invalidUtf8, { maxBytes: 100 }), /UTF-8/);
  const invalidJson = new Response("{broken");
  await assert.rejects(readBoundedJson(invalidJson, { maxBytes: 100 }), /JSON/);
});
