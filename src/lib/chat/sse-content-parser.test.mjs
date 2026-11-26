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
  parser.push('data: {"choices":[{"delta":{"content":"A"}}]}\r\n\r\n');
  parser.push('data: {"choices":[{"delta":{"content":"B"}}]}');
  parser.finish();
  assert.deepEqual(output, ["A", "B"]);
});

test("joins multiple data fields in one standards-compliant SSE event", () => {
  const output = [];
  const parser = createSseContentParser((delta) => output.push(delta));
  parser.push('event: message\ndata: {"choices":\ndata: [{"delta":{"content":"joined"}}]}\n\n');
  assert.deepEqual(output, ["joined"]);
  parser.finish();
});

test("preserves data whitespace and ignores comments, metadata, empty frames and malformed JSON", () => {
  const output = [];
  const parser = createSseContentParser((delta) => output.push(delta));
  parser.push(': keepalive\nevent: message\ndata: \ndata: not-json\ndata: {"choices":[{"delta":{"role":"assistant"}}]}\n\n');
  parser.push('data: {"choices":[{"delta":{"content":" leading"}}]}\n\n');
  parser.finish();
  assert.deepEqual(output, [" leading"]);
});

test("rejects invalid handlers, non-string chunks and use after finish", () => {
  assert.throws(() => createSseContentParser(null), /handler/);
  const parser = createSseContentParser(() => {});
  assert.throws(() => parser.push(42), /strings/);
  parser.finish();
  assert.throws(() => parser.push("data: x"), /closed/);
});
