import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("./page.jsx", import.meta.url), "utf8");
const buildRoute = readFileSync(new URL("../api/build/project/route.js", import.meta.url), "utf8");
const statusRoute = readFileSync(new URL("../api/build/status/route.js", import.meta.url), "utf8");
const contentRoute = readFileSync(new URL("../api/files/[id]/content/route.js", import.meta.url), "utf8");

test("Experience Lab Build mode loads owned projects and Build Engine status", () => {
  assert.match(page, /fetch\("\/api\/projects"/);
  assert.match(page, /fetch\("\/api\/build\/status"/);
  assert.match(page, /setSelectedProjectId/);
});

test("Build and Test actions call the authenticated isolated project endpoint", () => {
  assert.match(page, /fetch\("\/api\/build\/project"/);
  assert.match(page, /runBuildOperation\("build"\)/);
  assert.match(page, /runBuildOperation\("test"\)/);
  assert.match(buildRoute, /supabase\.auth\.getUser\(\)/);
  assert.match(buildRoute, /AAHANA_BUILD_ENGINE_ENABLED !== "true"/);
});

test("Build execution controls stay disabled without enabled engine and sandbox identity", () => {
  assert.match(page, /!buildStatus\?\.enabled \|\| !buildStatus\?\.sandboxIdentityAvailable/);
  assert.match(page, /disabled=\{!selectedProjectId \|\| buildBusy \|\| !buildStatus\?\.enabled \|\| !buildStatus\?\.sandboxIdentityAvailable\} onClick=\{\(\) => runBuildOperation\("test"\)\}/);
  assert.match(statusRoute, /sandboxIdentityAvailable: Boolean\(process\.env\.VERCEL_OIDC_TOKEN\)/);
});

test("Build Mode uploads only supported project source files through authenticated storage", () => {
  assert.match(page, /getSourceFileMimeType/);
  assert.match(page, /isSupportedSourceFile\(file\.name, mimeType\)/);
  assert.match(page, /file\.size > 1024 \* 1024/);
  assert.match(page, /storage\.from\("aahana-private"\)\.upload/);
  assert.match(page, /body: JSON\.stringify\(\{ objectPath, originalFilename: file\.name, mimeType, sizeBytes: file\.size, projectId: selectedProjectId \}\)/);
  assert.match(page, /Add source files/);
  assert.match(buildRoute, /isProjectSourceFile/);
});

test("Inline source editor reads and saves only the signed-in owner's private project source", () => {
  assert.match(page, /\/api\/files\/\$\{encodeURIComponent\(file\.id\)\}\/content/);
  assert.match(page, /method: "PUT"/);
  assert.match(contentRoute, /supabase\.auth\.getUser\(\)/);
  assert.match(contentRoute, /\.eq\("user_id", userId\)/);
  assert.match(contentRoute, /file\.bucket_id !== BUCKET/);
  assert.match(contentRoute, /TextDecoder\("utf-8", \{ fatal: true \}\)/);
  assert.match(contentRoute, /MAX_BYTES/);
  assert.match(contentRoute, /upsert: true/);
});
