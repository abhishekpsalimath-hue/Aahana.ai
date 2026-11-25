import test from "node:test";
import assert from "node:assert/strict";
import { readBoundedImageGenerationJson } from "./bounded-image-generation-json.mjs";

test("reads valid JSON across fragmented request chunks", async () => {
  const request = new Request("https://example.test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"prompt":'));
        controller.enqueue(new TextEncoder().encode('"portrait","steps":8}'));
        controller.close();
      },
    }),
    duplex: "half",
  });
  assert.deepEqual(await readBoundedImageGenerationJson(request), {
    ok: true, value: { prompt: "portrait", steps: 8 },
  });
});

test("rejects declared request sizes above the cap before reading", async () => {
  const request = new Request("https://example.test", {
    method: "POST",
    headers: { "content-length": "16385" },
    body: "{}",
  });
  const result = await readBoundedImageGenerationJson(request, 16384);
  assert.equal(result.status, 413);
});

test("cancels a streamed request when its actual size exceeds the cap", async () => {
  let cancelled = false;
  const request = new Request("https://example.test", {
    method: "POST",
    body: new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(10)); },
      cancel() { cancelled = true; },
    }),
    duplex: "half",
  });
  const result = await readBoundedImageGenerationJson(request, 8);
  assert.equal(result.status, 413);
  assert.equal(cancelled, true);
});

test("rejects malformed JSON, non-object JSON, and invalid content lengths", async () => {
  for (const body of ["{", "null", "[]", '"text"']) {
    const result = await readBoundedImageGenerationJson(new Request("https://example.test", {
      method: "POST", body,
    }));
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
  }
  const invalidLength = await readBoundedImageGenerationJson(new Request("https://example.test", {
    method: "POST", headers: { "content-length": "12x" }, body: "{}",
  }));
  assert.equal(invalidLength.status, 400);
});

test("rejects invalid byte limits", async () => {
  const request = new Request("https://example.test", { method: "POST", body: "{}" });
  assert.equal((await readBoundedImageGenerationJson(request, 0)).status, 500);
});
