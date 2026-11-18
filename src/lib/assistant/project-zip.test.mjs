import test from "node:test";
import assert from "node:assert/strict";
import { createStoredZip, extractProjectFiles } from "./project-zip.mjs";

const fence = String.fromCharCode(96).repeat(3);

test("extracts multiple named project files and ignores unsafe paths", () => {
  const files = extractProjectFiles([
    fence + "tsx src/app/page.tsx\nexport default function Page() {}\n" + fence,
    fence + "json package.json\n{\"scripts\":{\"dev\":\"next dev\"}}\n" + fence,
    fence + "js ../private.txt\nnope\n" + fence,
  ].join("\n"));
  assert.deepEqual(files.map((file) => file.path), ["src/app/page.tsx", "package.json"]);
  assert.match(files[0].content, /export default function Page/);
});

test("creates an uncompressed ZIP with nested filenames and UTF-8 content", () => {
  const archive = createStoredZip([
    { path: "src/app/page.tsx", content: "export default () => <main>Hello</main>;" },
    { path: "package.json", content: "{\"name\":\"demo\"}" },
    { path: "README.md", content: "Aahana project — ready to edit" },
  ]);
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint16(8, true), 0);
  assert.equal(view.getUint32(archive.length - 22, true), 0x06054b50);
  assert.equal(view.getUint16(archive.length - 12, true), 3);
  const text = new TextDecoder().decode(archive);
  assert.ok(text.includes("src/app/page.tsx"));
  assert.ok(text.includes("package.json"));
  assert.ok(text.includes("README.md"));
  assert.ok(text.includes("Aahana project — ready to edit"));
});

test("rejects empty or entirely unsafe ZIP inputs", () => {
  assert.throws(() => createStoredZip([]), /At least one/);
  assert.throws(() => createStoredZip([{ path: "../secret", content: "x" }]), /No safe/);
});
