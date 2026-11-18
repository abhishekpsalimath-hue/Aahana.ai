import test from "node:test";
import assert from "node:assert/strict";
import { getCodeDownloadName, getSafeCodeFilePath } from "./code-file-policy.mjs";

test("extracts safe relative paths from language-labelled code fences", () => {
  assert.equal(getSafeCodeFilePath("tsx src/app/page.tsx"), "src/app/page.tsx");
  assert.equal(getSafeCodeFilePath("json package.json"), "package.json");
  assert.equal(getSafeCodeFilePath("css src/app/globals.css"), "src/app/globals.css");
});

test("rejects absolute, traversal and malformed file paths", () => {
  for (const label of [
    "tsx /etc/passwd",
    "js ../secrets.txt",
    "tsx src/../secret.txt",
    "tsx src//page.tsx",
    "tsx src\\\\page.tsx",
    "tsx src/page name.tsx",
    "tsx",
  ]) assert.equal(getSafeCodeFilePath(label), null, label);
});

test("keeps nested file paths distinct when browser downloads flatten folders", () => {
  assert.equal(getCodeDownloadName("src/app/page.tsx"), "src__app__page.tsx");
  assert.equal(getCodeDownloadName("src/components/page.tsx"), "src__components__page.tsx");
  assert.notEqual(getCodeDownloadName("src/app/page.tsx"), getCodeDownloadName("src/components/page.tsx"));
});
