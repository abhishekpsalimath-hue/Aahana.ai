import test from "node:test";
import assert from "node:assert/strict";
import { createReplyPersistence } from "./stream-persistence.mjs";

test("persists a non-empty partial reply once when completion and cancellation race", async () => {
  let reply = "Partial answer";
  const writes = [];
  const persistReply = createReplyPersistence({
    getContent: () => reply,
    persist: async (content) => { writes.push(content); await Promise.resolve(); },
  });

  await Promise.all([persistReply(), persistReply()]);
  reply += " more text";
  await persistReply();

  assert.deepEqual(writes, ["Partial answer"]);
});

test("does not persist an empty or whitespace-only reply", async () => {
  let reply = "   ";
  let writes = 0;
  const persistReply = createReplyPersistence({ getContent: () => reply, persist: async () => { writes += 1; } });
  await persistReply();
  assert.equal(writes, 0);
  reply = "Ready";
  await persistReply();
  assert.equal(writes, 1);
});

test("caps persisted content at 16000 characters", async () => {
  let saved = "";
  const persistReply = createReplyPersistence({ getContent: () => "x".repeat(17000), persist: async (content) => { saved = content; } });
  await persistReply();
  assert.equal(saved.length, 16000);
});

test("reports persistence exceptions without creating unhandled rejections", async () => {
  const errors = [];
  const persistReply = createReplyPersistence({
    getContent: () => "A reply",
    persist: async () => { throw new Error("database unavailable"); },
    onError: (error) => errors.push(error.message),
  });
  await assert.doesNotReject(persistReply());
  assert.deepEqual(errors, ["database unavailable"]);
});
