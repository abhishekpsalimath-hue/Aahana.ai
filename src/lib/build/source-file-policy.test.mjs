import test from "node:test";
import assert from "node:assert/strict";
import { getSourceFileMimeType, isSupportedSourceFile } from "./source-file-policy.mjs";

test("maps web source files to stable text MIME types", () => {
  assert.equal(getSourceFileMimeType("package.json", "application/octet-stream"), "application/json");
  assert.equal(getSourceFileMimeType("src/App.tsx", "video/mp2t"), "text/javascript");
  assert.equal(getSourceFileMimeType("styles.css", ""), "text/css");
  assert.equal(getSourceFileMimeType("index.html", ""), "text/html");
});

test("accepts only known source extensions and text-compatible MIME types", () => {
  assert.equal(isSupportedSourceFile("package.json", "application/json"), true);
  assert.equal(isSupportedSourceFile("src/App.tsx", "text/javascript"), true);
  assert.equal(isSupportedSourceFile("src/App.tsx", "application/octet-stream"), true);
  assert.equal(isSupportedSourceFile("src/App.tsx", "application/x-msdownload"), false);
  assert.equal(isSupportedSourceFile("payload.exe", "application/octet-stream"), false);
});
test("validates private object paths against owner and project boundaries", async () => {
  const { isSafePrivateObjectPath } = await import("./source-file-policy.mjs");
  assert.equal(isSafePrivateObjectPath("user-1/project-1/file.js", "user-1", "project-1"), true);
  assert.equal(isSafePrivateObjectPath("user-2/project-1/file.js", "user-1", "project-1"), false);
  assert.equal(isSafePrivateObjectPath("user-1/project-2/file.js", "user-1", "project-1"), false);
  assert.equal(isSafePrivateObjectPath("user-1/project-1/../secret", "user-1", "project-1"), false);
  assert.equal(isSafePrivateObjectPath("user-1/project-1/%2e%2e", "user-1", "project-1"), false);
  assert.equal(isSafePrivateObjectPath("user-1/project-1/a\\\\b.js", "user-1", "project-1"), false);
  assert.equal(isSafePrivateObjectPath("user-1/project-1/\\u0000.js", "user-1", "project-1"), false);
  assert.equal(isSafePrivateObjectPath("user-1/project-1/" + "a".repeat(1025), "user-1", "project-1"), false);
});
