import test from "node:test";
import assert from "node:assert/strict";
import { createAgentToolCallLedger, recordAgentToolCalls } from "./tool-call-ledger.mjs";

const call = (id, name = "read_approved_source_file", args = { path: "src/example.mjs" }) =>
  ({ id, name, args });

test("records unique calls across separate execution rounds", () => {
  const ledger = createAgentToolCallLedger();
  assert.equal(recordAgentToolCalls(ledger, [call("one")]).ok, true);
  assert.equal(recordAgentToolCalls(ledger, [call("two", "read_approved_source_file", { path: "src/other.mjs" })]).ok, true);
  assert.equal(ledger.ids.size, 2);
  assert.equal(ledger.fingerprints.size, 2);
});

test("rejects a reused call identifier across rounds", () => {
  const ledger = createAgentToolCallLedger();
  assert.equal(recordAgentToolCalls(ledger, [call("same")]).ok, true);
  const result = recordAgentToolCalls(ledger, [call("same", "read_approved_source_file", { path: "src/other.mjs" })]);
  assert.equal(result.ok, false);
  assert.match(result.error, /identifier/);
});

test("rejects identical calls even when object key order differs", () => {
  const ledger = createAgentToolCallLedger();
  assert.equal(recordAgentToolCalls(ledger, [call("one", "read_approved_source_file", { path: "src/example.mjs", mode: "full" })]).ok, true);
  const result = recordAgentToolCalls(ledger, [call("two", "read_approved_source_file", { mode: "full", path: "src/example.mjs" })]);
  assert.equal(result.ok, false);
  assert.match(result.error, /identical tool request/);
});

test("rejects duplicate calls within a batch without partially recording it", () => {
  const ledger = createAgentToolCallLedger();
  const result = recordAgentToolCalls(ledger, [call("one"), call("two")]);
  assert.equal(result.ok, false);
  assert.equal(ledger.ids.size, 0);
  assert.equal(ledger.fingerprints.size, 0);
});

test("rejects invalid calls and accepts a changed request", () => {
  const ledger = createAgentToolCallLedger();
  assert.equal(recordAgentToolCalls(ledger, [{ id: "bad", name: "tool", args: [] }]).ok, false);
  assert.equal(recordAgentToolCalls(ledger, [call("one")]).ok, true);
  assert.equal(recordAgentToolCalls(ledger, [call("two", "read_approved_source_file", { path: "src/example.mjs", section: "exports" })]).ok, true);
});
