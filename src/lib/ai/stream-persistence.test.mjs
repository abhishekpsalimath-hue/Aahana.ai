import test from "node:test";
import assert from "node:assert/strict";
import { createReplyPersistence } from "./stream-persistence.mjs";

test("persists partial reply once when completion and cancellation race", async () => {
  let reply = "Partial answer"; const writes = [];
  const persist = createReplyPersistence({ getContent: () => reply, persist: async (content) => { writes.push(content); } });
  await Promise.all([persist(), persist()]); reply += " more"; await persist();
  assert.deepEqual(writes, ["Partial answer"]);
});
test("skips empty replies and permits later non-empty content", async () => {
  let reply = " "; let writes = 0;
  const persist = createReplyPersistence({ getContent: () => reply, persist: async () => { writes++; } });
  await persist(); assert.equal(writes, 0); reply = "answer"; await persist(); assert.equal(writes, 1);
});
test("caps persisted content at 16000 characters", async () => {
  let saved = ""; const persist = createReplyPersistence({ getContent: () => "x".repeat(17000), persist: async (v) => { saved = v; } });
  await persist(); assert.equal(saved.length, 16000);
});
test("swallows and reports persistence errors", async () => {
  const errors = []; const persist = createReplyPersistence({ getContent: () => "answer", persist: async () => { throw Error("db"); }, onError: (e) => errors.push(e.message) });
  await assert.doesNotReject(persist()); assert.deepEqual(errors, ["db"]);
});
