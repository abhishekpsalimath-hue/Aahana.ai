import test from "node:test";
import assert from "node:assert/strict";
import { createSseContentParser } from "./sse-content-parser.mjs";

test("parses provider deltas when JSON frames are split across network chunks", () => {
  const output = [];
  const parser = createSseContentParser((delta) => output.push(delta));
  parser.push('data: {"choices":[{"delta":{"content":"Hel');
  parser.push('lo"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n\n');
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

test("ignores a UTF-8 BOM at the beginning of the stream", () => {
  const output = [];
  const parser = createSseContentParser((delta) => output.push(delta));
  parser.push('\uFEFFdata: {"choices":[{"delta":{"content":"hello"}}]}\\n\\n');
  parser.finish();
  assert.deepEqual(output, ["hello"]);
});

test("bounds unterminated and multi-line SSE events", () => {
  const parser = createSseContentParser(() => {}, { maxEventChars: 24 });
  assert.throws(() => parser.push("data: " + "x".repeat(30)), /size limit/);
  assert.throws(() => parser.push("data: x"), /closed/);

  const joined = createSseContentParser(() => {}, { maxEventChars: 20 });
  assert.throws(() => joined.push("data: 1234567890\\ndata: 1234567890\\n"), /size limit/);
});

test("rejects invalid SSE event limits", () => {
  assert.throws(() => createSseContentParser(() => {}, { maxEventChars: 0 }), /positive safe integer/);
  assert.throws(() => createSseContentParser(() => {}, { maxEventChars: Number.MAX_SAFE_INTEGER + 1 }), /positive safe integer/);
});
