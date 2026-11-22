import test from "node:test";
import assert from "node:assert/strict";
import { getPreviewCommand } from "./preview-policy.mjs";

test("starts Next.js preview servers on the exposed interface and port", () => {
  const command = getPreviewCommand({ dependencies: { next: "^16.2.0" }, scripts: { dev: "next dev" } });
  assert.equal(command.command, "npm");
  assert.deepEqual(command.args, ["run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]);
});

test("starts Vite preview servers on the exposed interface and fixed port", () => {
  const command = getPreviewCommand({ devDependencies: { vite: "^6.0.0" }, scripts: { dev: "vite" } });
  assert.equal(command.command, "npm");
  assert.deepEqual(command.args, ["run", "dev", "--", "--host", "0.0.0.0", "--port", "3000", "--strictPort"]);
});

test("rejects projects without a bounded development script", () => {
  assert.throws(() => getPreviewCommand({ dependencies: { next: "^16.2.0" }, scripts: {} }), /dev script/);
  assert.throws(() => getPreviewCommand({ dependencies: { next: "^16.2.0" }, scripts: { dev: "x".repeat(501) } }), /dev script/);
});

test("rejects unsupported frameworks rather than guessing a server command", () => {
  assert.throws(() => getPreviewCommand({ dependencies: { react: "^19.1.0" }, scripts: { dev: "custom-server" } }), /supports Next.js and Vite/);
});
