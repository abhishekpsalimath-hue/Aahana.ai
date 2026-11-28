import test from "node:test";
import assert from "node:assert/strict";
import { validateAgentToolCalls } from "./tool-call-guard.mjs";

const call = (id, name = "list_approved_source_files", args = "{}") => ({
  id, type: "function", function: { name, arguments: args },
});

test("accepts a bounded, uniquely identified allowed tool call", () => {
  const result = validateAgentToolCalls([call("call_123")]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.calls[0], { id: "call_123", name: "list_approved_source_files", args: {} });
});

test("rejects missing, malformed and duplicate tool-call identifiers", () => {
  assert.equal(validateAgentToolCalls([call("")]).ok, false);
  assert.equal(validateAgentToolCalls([call("bad id")]).ok, false);
  assert.equal(validateAgentToolCalls([call("same"), call("same")]).ok, false);
});

test("rejects unknown tools and phase-inappropriate planning tools", () => {
  assert.equal(validateAgentToolCalls([call("x", "shell")]).ok, false);
  assert.equal(validateAgentToolCalls([call("x", "read_approved_source_file")], { phase: "plan" }).ok, false);
});

test("rejects malformed, non-object and oversized arguments", () => {
  assert.equal(validateAgentToolCalls([call("x", "list_approved_source_files", "{")]).ok, false);
  assert.equal(validateAgentToolCalls([call("x", "list_approved_source_files", "[]")]).ok, false);
  assert.equal(validateAgentToolCalls([call("x", "list_approved_source_files", "x".repeat(16 * 1024 + 1))]).ok, false);
});

test("rejects empty and excessive tool-call batches", () => {
  assert.equal(validateAgentToolCalls([]).ok, false);
  assert.equal(validateAgentToolCalls(Array.from({ length: 9 }, (_, i) => call("id" + i))).ok, false);
});
