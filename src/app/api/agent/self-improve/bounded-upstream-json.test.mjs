import test from "node:test";
import assert from "node:assert/strict";
import { readBoundedUpstreamJson } from "./bounded-upstream-json.mjs";

function responseFromChunks(chunks, headers = {}) {
  let index = 0;
  let cancelled = false;
  const body = new ReadableStream({
    pull(controller) {
      if (index < chunks.length) controller.enqueue(new TextEncoder().encode(chunks[index++]));
      else controller.close();
    },
    cancel() { cancelled = true; },
  });
  return { response: new Response(body, { headers }), wasCancelled: () => cancelled };
}

test("reads valid JSON split across stream chunks", async () => {
  const { response } = responseFromChunks(['{"choices":[', '{"message":{"content":"ok"}}]}']);
  const value = await readBoundedUpstreamJson(response);
  assert.equal(value.choices[0].message.content, "ok");
});

test("rejects declared oversized upstream responses before parsing", async () => {
  const { response } = responseFromChunks(['{}'], { "content-length": "1025" });
  await assert.rejects(readBoundedUpstreamJson(response, 1024), { code: "TOO_LARGE" });
});

test("rejects streamed overflow and cancels the reader", async () => {
  const { response, wasCancelled } = responseFromChunks(['{"x":"', "a".repeat(100), '"}']);
  await assert.rejects(readBoundedUpstreamJson(response, 32), { code: "TOO_LARGE" });
  assert.equal(wasCancelled(), true);
});

test("rejects malformed JSON and non-object JSON", async () => {
  const malformed = responseFromChunks(["{"]);
  await assert.rejects(readBoundedUpstreamJson(malformed.response), { code: "INVALID_JSON" });
  const array = responseFromChunks(["[]"]);
  await assert.rejects(readBoundedUpstreamJson(array.response), { code: "INVALID_SHAPE" });
  const scalar = responseFromChunks(['"text"']);
  await assert.rejects(readBoundedUpstreamJson(scalar.response), { code: "INVALID_SHAPE" });
});

test("rejects invalid content lengths and invalid limits", async () => {
  const invalidLength = responseFromChunks(["{}"], { "content-length": "1x" });
  await assert.rejects(readBoundedUpstreamJson(invalidLength.response), { code: "INVALID_LENGTH" });
  const valid = responseFromChunks(["{}"]);
  await assert.rejects(readBoundedUpstreamJson(valid.response, 0), { code: "INVALID_RESPONSE" });
});
