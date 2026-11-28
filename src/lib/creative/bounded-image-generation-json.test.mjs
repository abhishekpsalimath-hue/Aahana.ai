import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_IMAGE_GENERATION_REQUEST_BYTES,
  MAX_IMAGE_PROVIDER_RESPONSE_BYTES,
  readBoundedImageGenerationJson,
  readBoundedImageProviderJson,
} from "./bounded-image-generation-json.mjs";

function requestFrom(body, headers = {}) {
  return new Request("https://aahana.test/api/images/generate", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

function responseFrom(body, headers = {}) {
  return new Response(body, { headers: { "content-type": "application/json", ...headers } });
}

test("accepts a bounded image-generation JSON object", async () => {
  assert.deepEqual(await readBoundedImageGenerationJson(requestFrom('{"prompt":"A portrait"}')), {
    ok: true, value: { prompt: "A portrait" },
  });
});

test("rejects malformed, non-object, and invalid UTF-8 request bodies", async () => {
  for (const body of ["{", "null", "[]", '"text"', new Uint8Array([0xc3, 0x28])]) {
    const result = await readBoundedImageGenerationJson(requestFrom(body));
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
  }
});

test("rejects invalid and oversized declared request lengths", async () => {
  assert.equal((await readBoundedImageGenerationJson(requestFrom("{}", { "content-length": "2x" }))).status, 400);
  assert.equal((await readBoundedImageGenerationJson(requestFrom("{}", {
    "content-length": String(MAX_IMAGE_GENERATION_REQUEST_BYTES + 1),
  }))).status, 413);
});

test("enforces the request byte limit while streaming without a declared length", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(MAX_IMAGE_GENERATION_REQUEST_BYTES));
      controller.enqueue(new Uint8Array([0x7b]));
    },
    cancel() { cancelled = true; },
  });
  const request = new Request("https://aahana.test/api/images/generate", { method: "POST", body, duplex: "half" });
  const result = await readBoundedImageGenerationJson(request);
  assert.equal(result.status, 413);
  assert.equal(cancelled, true);
});

test("rejects missing request bodies and invalid request limits", async () => {
  assert.equal((await readBoundedImageGenerationJson(new Request("https://aahana.test"))).status, 400);
  assert.equal((await readBoundedImageGenerationJson(requestFrom("{}"), 0)).status, 500);
});

test("accepts a bounded provider JSON object", async () => {
  assert.deepEqual(await readBoundedImageProviderJson(responseFrom('{"result":{"image":"AAAA"}}')), {
    ok: true, value: { result: { image: "AAAA" } },
  });
});

test("rejects empty, malformed, non-object, and invalid UTF-8 provider responses", async () => {
  for (const body of ["", "{", "null", "[]", new Uint8Array([0xc3, 0x28])]) {
    assert.equal((await readBoundedImageProviderJson(responseFrom(body))).ok, false);
  }
});

test("rejects oversized provider responses by declared and streamed byte lengths", async () => {
  const declared = await readBoundedImageProviderJson(responseFrom("{}", {
    "content-length": String(MAX_IMAGE_PROVIDER_RESPONSE_BYTES + 1),
  }));
  assert.equal(declared.ok, false);
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(MAX_IMAGE_PROVIDER_RESPONSE_BYTES));
      controller.enqueue(new Uint8Array([0x7b]));
    },
  });
  const streamed = await readBoundedImageProviderJson(new Response(body));
  assert.equal(streamed.ok, false);
  assert.match(streamed.error, /too large/i);
});

test("rejects invalid provider response limits", async () => {
  assert.equal((await readBoundedImageProviderJson(responseFrom("{}"), 0)).ok, false);
});


test("cancels a stalled request-body read when the client disconnects", async () => {
  const controller = new AbortController();
  let cancelled = false;
  const body = new ReadableStream({
    pull() { return new Promise(() => {}); },
    cancel() { cancelled = true; },
  });
  const request = new Request("https://aahana.test/api/images/generate", {
    method: "POST", body, duplex: "half", signal: controller.signal,
  });
  const pending = readBoundedImageGenerationJson(request);
  controller.abort();
  const result = await pending;
  assert.equal(result.aborted, true);
  assert.equal(result.status, 499);
  assert.equal(cancelled, true);
});

test("cancels a stalled provider-response read when the client disconnects", async () => {
  const controller = new AbortController();
  let cancelled = false;
  const body = new ReadableStream({
    pull() { return new Promise(() => {}); },
    cancel() { cancelled = true; },
  });
  const response = new Response(body);
  const pending = readBoundedImageProviderJson(response, MAX_IMAGE_PROVIDER_RESPONSE_BYTES, controller.signal);
  controller.abort();
  const result = await pending;
  assert.equal(result.aborted, true);
  assert.equal(cancelled, true);
});

test("does not read request or provider streams when the signal is already aborted", async () => {
  const requestController = new AbortController();
  requestController.abort();
  const request = new Request("https://aahana.test/api/images/generate", {
    method: "POST", body: "{}", duplex: "half", signal: requestController.signal,
  });
  assert.equal((await readBoundedImageGenerationJson(request)).status, 499);

  const providerController = new AbortController();
  providerController.abort();
  const provider = await readBoundedImageProviderJson(responseFrom("{}"), MAX_IMAGE_PROVIDER_RESPONSE_BYTES, providerController.signal);
  assert.equal(provider.aborted, true);
});
