import test from "node:test";
import assert from "node:assert/strict";
import { readBoundedMultipartFormData } from "./bounded-multipart.mjs";

test("parses a bounded multipart message and image", async () => {
  const form = new FormData();
  form.set("message", "Describe this image");
  form.set("mode", "solve");
  form.set("image", new File([new Uint8Array([1, 2, 3])], "sample.png", { type: "image/png" }));
  const request = new Request("https://aahana.invalid/api/chat", { method: "POST", body: form });
  const parsed = await readBoundedMultipartFormData(request, 4096);
  assert.equal(parsed.get("message"), "Describe this image");
  assert.equal(parsed.get("mode"), "solve");
  assert.equal(parsed.get("image").name, "sample.png");
  assert.equal(parsed.get("image").size, 3);
});

test("rejects non-multipart requests and missing boundaries", async () => {
  await assert.rejects(
    readBoundedMultipartFormData(new Request("https://aahana.invalid", { method: "POST", body: "{}" }), 100),
    (error) => error.status === 400
  );
  const request = new Request("https://aahana.invalid", { method: "POST", headers: { "content-type": "multipart/form-data" }, body: "x" });
  await assert.rejects(readBoundedMultipartFormData(request, 100), (error) => error.status === 400);
});

test("rejects a declared oversized body before reading it", async () => {
  const request = new Request("https://aahana.invalid", {
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=abc", "content-length": "9999" },
    body: "--abc--",
  });
  await assert.rejects(readBoundedMultipartFormData(request, 100), (error) => error.status === 413);
});

test("enforces the actual streamed byte limit when content length is absent", async () => {
  const request = new Request("https://aahana.invalid", {
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=abc" },
    body: "--abc\r\nContent-Disposition: form-data; name=\"message\"\r\n\r\n" + "x".repeat(500) + "\r\n--abc--",
  });
  await assert.rejects(readBoundedMultipartFormData(request, 100), (error) => error.status === 413);
});
