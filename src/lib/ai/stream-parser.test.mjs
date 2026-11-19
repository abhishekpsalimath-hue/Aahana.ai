import test from "node:test";
import assert from "node:assert/strict";
import { createSseDeltaParser } from "./stream-parser.mjs";

const frame = (content) => \`data: \${JSON.stringify({ choices: [{ delta: { content } }] })}\`;

test("parses frames split across arbitrary network chunks", () => {
  const output = [];
  const parser = createSseDeltaParser((delta) => output.push(delta));
  const input = frame("Hello") + "\r\n\r\n" + frame(" world") + "\r\n";
  parser.push(input.slice(0, 7));
  parser.push(input.slice(7, 31));
  parser.push(input.slice(31));
  parser.flush();
  assert.deepEqual(output, ["Hello", " world"]);
});

test("parses a final frame without a trailing newline", () => {
  const output = [];
  const parser = createSseDeltaParser((delta) => output.push(delta));
  parser.push(frame("final"));
  parser.flush();
  assert.deepEqual(output, ["final"]);
});

test("ignores comments, keepalives, malformed JSON and DONE", () => {
  const output = [];
  const parser = createSseDeltaParser((delta) => output.push(delta));
  parser.push(": keepalive\n\nevent: message\ndata: not-json\n\ndata: [DONE]\n");
  parser.flush();
  assert.deepEqual(output, []);
});

test("rejects invalid callbacks", () => {
  assert.throws(() => createSseDeltaParser(null), TypeError);
});
