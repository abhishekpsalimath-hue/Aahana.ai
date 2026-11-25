import test from "node:test";
import assert from "node:assert/strict";
import { readBoundedRequestBody, readBoundedResponseJson } from "./bounded-request-body.mjs";

function makeRequest(chunks, { contentLength, fail = false } = {}) {
  let index = 0;
  let canceled = false;
  const body = new ReadableStream({
    pull(controller) {
      if (fail && index === 1) {
        controller.error(new Error("stream interrupted"));
        return;
      }
      if (index < chunks.length) controller.enqueue(new Uint8Array(chunks[index++]));
      else controller.close();
    },
    cancel() { canceled = true; },
  });
  const headers = new Headers();
  if (contentLength !== undefined) headers.set("content-length", contentLength);
  return { request: { headers, body }, wasCanceled: () => canceled };
}

test("reads fragmented request bodies within the byte budget", async () => {
  const { request } = makeRequest([[1, 2], [3, 4]], { contentLength: "4" });
  const result = await readBoundedRequestBody(request, 4);
  assert.equal(result.ok, true);
  assert.deepEqual([...result.bytes], [1, 2, 3, 4]);
});

test("rejects declared oversize bodies before reading the stream", async () => {
  const { request } = makeRequest([[1, 2, 3]], { contentLength: "3" });
  const result = await readBoundedRequestBody(request, 2);
  assert.deepEqual(result, { ok: false, reason: "too-large" });
});

test("cancels a stream when actual bytes exceed the limit", async () => {
  const { request, wasCanceled } = makeRequest([[1, 2], [3, 4]]);
  const result = await readBoundedRequestBody(request, 3);
  assert.deepEqual(result, { ok: false, reason: "too-large" });
  assert.equal(wasCanceled(), true);
});

test("rejects malformed lengths, missing bodies and interrupted streams", async () => {
  const malformed = makeRequest([[1]], { contentLength: "2x" });
  assert.deepEqual(await readBoundedRequestBody(malformed.request, 10), { ok: false, reason: "invalid" });
  assert.deepEqual(await readBoundedRequestBody({ headers: new Headers(), body: null }, 10), { ok: false, reason: "invalid" });
  const interrupted = makeRequest([[1], [2]], { fail: true });
  assert.deepEqual(await readBoundedRequestBody(interrupted.request, 10), { ok: false, reason: "invalid" });
});

test("rejects invalid byte limits", async () => {
  for (const limit of [0, -1, 1.5, "10", null]) {
    await assert.rejects(() => readBoundedRequestBody({ headers: new Headers(), body: null }, limit), TypeError);
  }
});


test("reads valid provider JSON within the response byte budget", async () => {
  const response = new Response(JSON.stringify({ state: "Completed", result: { video: "https://example.test/video.mp4" } }));
  const result = await readBoundedResponseJson(response, 1024);
  assert.equal(result.ok, true);
  assert.equal(result.value.state, "Completed");
});

test("rejects oversized provider responses from both declared and streamed lengths", async () => {
  const declared = new Response("{}", { headers: { "content-length": "2048" } });
  assert.deepEqual(await readBoundedResponseJson(declared, 10), { ok: false, reason: "too-large" });

  const streamed = new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(8));
      controller.enqueue(new Uint8Array(8));
      controller.close();
    },
  }));
  assert.deepEqual(await readBoundedResponseJson(streamed, 10), { ok: false, reason: "too-large" });
});

test("rejects malformed or non-object provider JSON", async () => {
  assert.deepEqual(await readBoundedResponseJson(new Response("{bad"), 100), { ok: false, reason: "invalid" });
  assert.deepEqual(await readBoundedResponseJson(new Response("[]"), 100), { ok: false, reason: "invalid" });
  await assert.rejects(() => readBoundedResponseJson(new Response("{}"), 0), TypeError);
});
