import test from "node:test";
import assert from "node:assert/strict";
import { createRequestTimeoutSignal, getClientAbortResponse } from "./request-timeout.mjs";

test("propagates caller cancellation to the provider signal", async () => {
  const controller = new AbortController();
  const signal = createRequestTimeoutSignal(controller.signal, 10_000);
  controller.abort(new Error("client disconnected"));
  assert.equal(signal.aborted, true);
  assert.equal(signal.reason.message, "client disconnected");
});

test("aborts when the provider timeout expires", async () => {
  const controller = new AbortController();
  const signal = createRequestTimeoutSignal(controller.signal, 5);
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(signal.aborted, true);
  assert.equal(signal.reason.name, "TimeoutError");
});

test("rejects a missing request signal or invalid timeout", () => {
  assert.throws(() => createRequestTimeoutSignal(null, 100), TypeError);
  const controller = new AbortController();
  assert.throws(() => createRequestTimeoutSignal(controller.signal, 0), RangeError);
});

test("distinguishes client cancellation from provider failures", () => {
  const controller = new AbortController();
  assert.equal(getClientAbortResponse(controller.signal), null);
  controller.abort();
  const response = getClientAbortResponse(controller.signal);
  assert.equal(response.status, 499);
});
