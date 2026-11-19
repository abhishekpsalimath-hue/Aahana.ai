import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("./page.jsx", import.meta.url), "utf8");
const buildRoute = readFileSync(new URL("../api/build/project/route.js", import.meta.url), "utf8");
const statusRoute = readFileSync(new URL("../api/build/status/route.js", import.meta.url), "utf8");

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
  assert.match(statusRoute, /sandboxIdentityAvailable: Boolean\(process\.env\.VERCEL_OIDC_TOKEN\)/);
});
