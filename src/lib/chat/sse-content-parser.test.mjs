import test from "node:test";
import assert from "node:assert/strict";
import { createSseContentParser } from "./sse-content-parser.mjs";

test("parses provider deltas when JSON frames are split across network chunks", () => {
  const output = [];
  const parser = createSseContentParser((delta) => output.push(delta));
  parser.push('data: {"choices":[{"delta":{"content":"Hel');
  parser.push('lo"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n');
  parser.push("data: [DONE]\n");
  parser.finish();
  assert.deepEqual(output, ["Hello", " world"]);
});

test("parses CRLF frames and a final frame without a trailing newline", () => {
  const output = [];
  const parser = createSseContentParser((delta) => output.push(delta));
  parser.push('data: {"choices":[{"delta":{"content":"A"}}]}\r\n');
  parser.push('data: {"choices":[{"delta":{"content":"B"}}]}');
  parser.finish();
  assert.deepEqual(output, ["A", "B"]);
});

test("ignores comments, metadata, empty frames, malformed JSON and non-text deltas", () => {
  const output = [];
  const parser = createSseContentParser((delta) => output.push(delta));
  parser.push(': keepalive\nevent: message\ndata: \ndata: not-json\ndata: {"choices":[{"delta":{"role":"assistant"}}]}\n');
  parser.finish();
  assert.deepEqual(output, []);
});

test("rejects invalid handlers and use after finish", () => {
  assert.throws(() => createSseContentParser(null), /handler/);
  const parser = createSseContentParser(() => {});
  parser.finish();
  assert.throws(() => parser.push("data: x"), /closed/);
});
