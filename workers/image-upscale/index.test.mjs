import test from "node:test";
import assert from "node:assert/strict";
import worker from "./index.mjs";

const SECRET = "test-only-secret";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

function makeEnv(calls = {}) {
  return {
    AAHANA_UPSCALE_SHARED_SECRET: SECRET,
    IMAGES: {
      input(bytes) {
        calls.inputBytes = bytes;
        return {
          transform(options) {
            calls.transformOptions = options;
            return {
              output(options) {
                calls.outputOptions = options;
                return {
                  async response(options) {
                    calls.responseOptions = options;
                    return new Response(new Uint8Array([1, 2, 3]), {
                      headers: { "Content-Type": "image/png" },
                    });
                  },
                };
              },
            };
          },
        };
      },
    },
  };
}

function makeRequest({ method = "POST", secret = SECRET, type = "image/png", bytes = PNG, headers = {} } = {}) {
  return new Request("https://worker.example/upscale", {
    method,
    headers: {
      Authorization: secret === null ? "" : `Bearer ${secret}`,
      "Content-Type": type,
      ...headers,
    },
    body: method === "GET" ? undefined : bytes,
  });
}

test("rejects requests without the server-to-server secret", async () => {
  const response = await worker.fetch(makeRequest({ secret: "wrong" }), makeEnv());
  assert.equal(response.status, 401);
});

test("rejects non-POST requests", async () => {
  const response = await worker.fetch(makeRequest({ method: "GET" }), makeEnv());
  assert.equal(response.status, 405);
});

test("rejects unsupported image types before processing", async () => {
  const response = await worker.fetch(makeRequest({ type: "image/gif" }), makeEnv());
  assert.equal(response.status, 415);
});

test("rejects a content-type and file-signature mismatch", async () => {
  const response = await worker.fetch(makeRequest({ type: "image/jpeg", bytes: PNG }), makeEnv());
  assert.equal(response.status, 415);
});

test("rejects oversized requests before reading the body", async () => {
  const response = await worker.fetch(
    makeRequest({ headers: { "Content-Length": String(20 * 1024 * 1024 + 1) } }),
    makeEnv(),
  );
  assert.equal(response.status, 413);
});

test("processes private bytes through the Images binding and returns no-store PNG", async () => {
  const calls = {};
  const response = await worker.fetch(makeRequest(), makeEnv(calls));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "image/png");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(Array.from(calls.inputBytes), Array.from(PNG));
  assert.deepEqual(calls.transformOptions, {
    width: 3840,
    height: 3840,
    fit: { mode: "contain", upscale: "generate" },
  });
  assert.deepEqual(calls.outputOptions, { format: "image/png" });
  assert.equal(calls.responseOptions.headers["Cache-Control"], "no-store");
});
