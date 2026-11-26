import test from "node:test";
import assert from "node:assert/strict";
import { readBoundedJson } from "./bounded-json.mjs";

function requestFromChunks(chunks, headers = {}) {
  let cancelled = false;
  const encoded = chunks.map((chunk) => new TextEncoder().encode(chunk));
  let index = 0;
  return {
    request: {
      headers: { get: (name) => headers[name.toLowerCase()] ?? null },
      body: new ReadableStream({
        pull(controller) {
          if (index >= encoded.length) controller.close();
          else controller.enqueue(encoded[index++]);
        },
        cancel() { cancelled = true; },
      }),
    },
    wasCancelled: () => cancelled,
  };
}

test("parses fragmented JSON within the byte limit", async () => {
  const { request } = requestFromChunks(['{"message":', '"hello"}']);
  assert.deepEqual(await readBoundedJson(request, 64), { message: "hello" });
});

test("rejects a declared body length above the limit before reading", async () => {
  const { request } = requestFromChunks(['{}'], { "content-length": "100" });
  await assert.rejects(readBoundedJson(request, 8), { status: 413 });
});

test("cancels a streamed body as soon as it exceeds the limit", async () => {
  const { request, wasCancelled } = requestFromChunks(["1234", "5678", "9"]);
  await assert.rejects(readBoundedJson(request, 8), { status: 413 });
  assert.equal(wasCancelled(), true);
});

test("rejects invalid JSON, invalid content length and a missing body", async () => {
  const invalidJson = requestFromChunks(["{broken"]);
  await assert.rejects(readBoundedJson(invalidJson.request, 100), { status: 400 });
  const invalidLength = requestFromChunks(["{}"], { "content-length": "unknown" });
  await assert.rejects(readBoundedJson(invalidLength.request, 100), { status: 400 });
  await assert.rejects(readBoundedJson({ headers: { get: () => null }, body: null }, 100), { status: 400 });
});

test("rejects invalid limits instead of silently disabling the bound", async () => {
  const { request } = requestFromChunks(["{}"]);
  await assert.rejects(readBoundedJson(request, 0), TypeError);
  await assert.rejects(readBoundedJson(request, 1.5), TypeError);
});


test("rejects malformed UTF-8 instead of silently replacing invalid bytes", async () => {
  let cancelled = false;
  const request = {
    headers: { get: () => null },
    body: new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array([0xc3, 0x28])); },
      cancel() { cancelled = true; },
    }),
  };
  await assert.rejects(readBoundedJson(request, 16), { status: 400 });
  assert.equal(cancelled, true);
});
