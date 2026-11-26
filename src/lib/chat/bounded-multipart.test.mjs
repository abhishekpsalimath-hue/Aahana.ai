import test from "node:test";
import assert from "node:assert/strict";
import { readBoundedMultipartFormData } from "./bounded-multipart.mjs";

function multipartRequest(parts, { boundary = "aahana-boundary", headers = {} } = {}) {
  const body = [
    ...parts.flatMap(({ name, value, filename, type }) => [
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="${name}"${filename ? `; filename="${filename}"` : ""}\r\n`,
      ...(type ? [`Content-Type: ${type}\r\n`] : []),
      "\r\n",
      value,
      "\r\n",
    ]),
    `--${boundary}--\r\n`,
  ].join("");
  const encoded = new TextEncoder().encode(body);
  let cancelled = false;
  let sent = false;
  return {
    request: {
      headers: {
        get(name) {
          const key = name.toLowerCase();
          return headers[key] ?? (key === "content-type" ? `multipart/form-data; boundary=${boundary}` : null);
        },
      },
      body: new ReadableStream({
        pull(controller) {
          if (sent) controller.close();
          else { sent = true; controller.enqueue(encoded); }
        },
        cancel() { cancelled = true; },
      }),
    },
    byteLength: encoded.byteLength,
    wasCancelled: () => cancelled,
  };
}

test("parses bounded multipart text and image fields without Base64", async () => {
  const input = multipartRequest([
    { name: "message", value: "Describe this" },
    { name: "mode", value: "solve" },
    { name: "image", filename: "reference.png", type: "image/png", value: "PNG-BYTES" },
  ]);
  const form = await readBoundedMultipartFormData(input.request, input.byteLength);
  assert.equal(form.get("message"), "Describe this");
  assert.equal(form.get("mode"), "solve");
  const image = form.get("image");
  assert.equal(image.name, "reference.png");
  assert.equal(image.type, "image/png");
  assert.equal(await image.text(), "PNG-BYTES");
});

test("preserves binary image bytes in a native multipart Request", async () => {
  const original = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x0d, 0x0a]);
  const form = new FormData();
  form.set("message", "Describe this reference");
  form.set("image", new Blob([original], { type: "image/png" }), "reference.png");
  const request = new Request("https://aahana.test/api/chat", { method: "POST", body: form });
  const parsed = await readBoundedMultipartFormData(request, 4096);
  const uploaded = parsed.get("image");
  assert.equal(uploaded.name, "reference.png");
  assert.equal(uploaded.type, "image/png");
  assert.deepEqual(new Uint8Array(await uploaded.arrayBuffer()), original);
});

test("rejects a declared oversized multipart body before reading", async () => {
  const input = multipartRequest([{ name: "message", value: "hello" }], { headers: { "content-length": "9999" } });
  await assert.rejects(readBoundedMultipartFormData(input.request, 100), { status: 413 });
  assert.equal(input.wasCancelled(), false);
});

test("cancels a chunked multipart body immediately after the limit is exceeded", async () => {
  const input = multipartRequest([{ name: "message", value: "x".repeat(200) }]);
  await assert.rejects(readBoundedMultipartFormData(input.request, 32), { status: 413 });
  assert.equal(input.wasCancelled(), true);
});

test("rejects missing boundaries, invalid lengths and absent bodies", async () => {
  const noBoundary = multipartRequest([{ name: "message", value: "hello" }]);
  noBoundary.request.headers.get = (name) => name.toLowerCase() === "content-type" ? "multipart/form-data" : null;
  await assert.rejects(readBoundedMultipartFormData(noBoundary.request, 1000), { status: 400 });

  const invalidLength = multipartRequest([{ name: "message", value: "hello" }], { headers: { "content-length": "unknown" } });
  await assert.rejects(readBoundedMultipartFormData(invalidLength.request, 1000), { status: 400 });

  await assert.rejects(readBoundedMultipartFormData({
    headers: { get: () => "multipart/form-data; boundary=x" },
    body: null,
  }, 1000), { status: 400 });
});

test("rejects invalid limits", async () => {
  const input = multipartRequest([{ name: "message", value: "hello" }]);
  await assert.rejects(readBoundedMultipartFormData(input.request, 0), TypeError);
  await assert.rejects(readBoundedMultipartFormData(input.request, 1.5), TypeError);
});
