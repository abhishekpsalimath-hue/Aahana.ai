import test from "node:test";
import assert from "node:assert/strict";
import { MAX_PERSISTED_ASSISTANT_REPLY_CHARS, prepareAssistantReplyForPersistence } from "./reply-persistence.mjs";

test("preserves complete ordinary and long assistant replies", () => {
  const short = "Aahana's answer.";
  const long = "x".repeat(32_000);
  assert.equal(prepareAssistantReplyForPersistence(short), short);
  assert.equal(prepareAssistantReplyForPersistence(long), long);
});

test("bounds persisted replies and handles malformed values safely", () => {
  const oversized = "y".repeat(MAX_PERSISTED_ASSISTANT_REPLY_CHARS + 10);
  const result = prepareAssistantReplyForPersistence(oversized);
  assert.equal(result.length, MAX_PERSISTED_ASSISTANT_REPLY_CHARS);
  assert.equal(result, oversized.slice(0, MAX_PERSISTED_ASSISTANT_REPLY_CHARS));
  assert.equal(prepareAssistantReplyForPersistence(null), "");
  assert.equal(prepareAssistantReplyForPersistence({ content: "unsafe" }), "");
});
