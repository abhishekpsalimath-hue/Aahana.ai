import test from "node:test";
import assert from "node:assert/strict";
import { extractBuildDiagnostics } from "./build-diagnostic-policy.mjs";

test("extracts TypeScript file, line, column and code", () => {
  const [item] = extractBuildDiagnostics({
    stderr: "src/page.tsx(12,8): error TS2304: Cannot find name 'Widget'.",
    exitCode: 2,
  });
  assert.equal(item.source, "typescript");
  assert.equal(item.file, "src/page.tsx");
  assert.equal(item.line, 12);
  assert.equal(item.column, 8);
  assert.equal(item.code, "TS2304");
});

test("extracts Vite/compiler and ESLint diagnostics", () => {
  const items = extractBuildDiagnostics({
    stderr: "src/main.js:4:3: ERROR: Expected identifier\nsrc/app.jsx 8:2 warning Avoid unused vars  no-unused-vars",
    exitCode: 1,
  });
  assert.equal(items[0].source, "compiler");
  assert.equal(items[0].line, 4);
  assert.equal(items[1].source, "eslint");
  assert.equal(items[1].code, "no-unused-vars");
});

test("extracts Python traceback locations and npm codes", () => {
  const items = extractBuildDiagnostics({
    stderr: "File \"src/main.py\", line 27, in main\nnpm ERR! code ERESOLVE",
    exitCode: 1,
  });
  assert.equal(items[0].source, "python");
  assert.equal(items[0].line, 27);
  assert.equal(items[1].code, "ERESOLVE");
});

test("uses a bounded generic diagnostic when output has no known format", () => {
  const items = extractBuildDiagnostics({ stderr: "opaque failure", exitCode: 1, operation: "test" });
  assert.equal(items.length, 1);
  assert.match(items[0].message, /test command exited unsuccessfully/);
});

test("does not fabricate diagnostics for successful commands", () => {
  assert.deepEqual(extractBuildDiagnostics({ stdout: "all good", exitCode: 0 }), []);
});

test("bounds output and rejects unsafe source paths", () => {
  const items = extractBuildDiagnostics({
    stderr: "../outside.ts(2,1): error TS1: bad",
    exitCode: 1,
  });
  assert.equal(items[0].file, null);
});
