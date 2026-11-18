import test from "node:test";
import assert from "node:assert/strict";
import { attachDiagnosticSourceContext } from "./diagnostic-source-context.mjs";

test("attaches a bounded excerpt around a matching diagnostic line", () => {
  const [item] = attachDiagnosticSourceContext(
    [{ file: "src/app.js", line: 4, message: "problem" }],
    [{ path: "src/app.js", content: "one\ntwo\nthree\nfour\nfive\nsix\nseven\neight" }],
  );
  assert.equal(item.sourceContext.startLine, 1);
  assert.equal(item.sourceContext.endLine, 7);
  assert.match(item.sourceContext.excerpt, />    4 \| four/);
});

test("does not attach source from a different or unsafe path", () => {
  const items = attachDiagnosticSourceContext(
    [
      { file: "src/missing.js", line: 1 },
      { file: "../secret.js", line: 1 },
    ],
    [{ path: "src/app.js", content: "secret source" }],
  );
  assert.equal(items[0].sourceContext, null);
  assert.equal(items[1].sourceContext, null);
});

test("ignores invalid line numbers and out-of-range lines", () => {
  const items = attachDiagnosticSourceContext(
    [
      { file: "src/app.js", line: 0 },
      { file: "src/app.js", line: 99 },
    ],
    [{ path: "src/app.js", content: "one\ntwo" }],
  );
  assert.equal(items[0].sourceContext, null);
  assert.equal(items[1].sourceContext, null);
});

test("bounds the number of returned diagnostics", () => {
  const items = attachDiagnosticSourceContext(
    Array.from({ length: 30 }, (_, line) => ({ file: "a.js", line: line + 1 })),
    [{ path: "a.js", content: Array.from({ length: 40 }, () => "x").join("\n") }],
  );
  assert.equal(items.length, 20);
});
