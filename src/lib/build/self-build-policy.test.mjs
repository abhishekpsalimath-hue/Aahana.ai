import test from "node:test";
import assert from "node:assert/strict";
import {
  getSelfBuildConfig,
  isSelfBuildOwner,
  isAllowedSelfBuildPath,
  validateSelfBuildChangeSet,
} from "./self-build-policy.mjs";

const baseSha = "a".repeat(40);
const configured = {
  AAHANA_GITHUB_APP_ID: "12345",
  AAHANA_GITHUB_INSTALLATION_ID: "67890",
  AAHANA_GITHUB_PRIVATE_KEY: "private-key-is-present",
  AAHANA_SELF_BUILD_REPOSITORY: "abhishekpsalimath-hue/Aahana.ai",
  AAHANA_SELF_BUILD_ALLOWED_EMAILS: "founder@example.com",
};

test("self-build remains disabled until every server-side integration setting is present", () => {
  assert.equal(getSelfBuildConfig({}).enabled, false);
  assert.deepEqual(getSelfBuildConfig({ ...configured, AAHANA_GITHUB_PRIVATE_KEY: "" }).missing,
    ["AAHANA_GITHUB_PRIVATE_KEY"]);
  assert.equal(getSelfBuildConfig(configured).enabled, true);
  assert.equal(getSelfBuildConfig({ ...configured, AAHANA_GITHUB_APP_ID: "not-an-id" }).enabled, false);
});

test("owner access is an exact case-insensitive email allowlist match", () => {
  const config = getSelfBuildConfig(configured);
  assert.equal(isSelfBuildOwner("FOUNDER@example.com", config), true);
  assert.equal(isSelfBuildOwner("other@example.com", config), false);
  assert.equal(isSelfBuildOwner("founder@example.com", getSelfBuildConfig({})), false);
});

test("only approved Experience Lab and non-security Build source paths are writable", () => {
  assert.equal(isAllowedSelfBuildPath("src/app/experience-lab/page.jsx"), true);
  assert.equal(isAllowedSelfBuildPath("src/app/assistant-workspace.jsx"), true);
  assert.equal(isAllowedSelfBuildPath("src/app/assistant-workspace.jsx/child.jsx"), false);
  assert.equal(isAllowedSelfBuildPath("src/app/assistant-workspace.jsx.backup"), false);
  assert.equal(isAllowedSelfBuildPath("src/app/assistant-workspace.css"), false);
  assert.equal(isAllowedSelfBuildPath("src/app/api/agent/self-improve/route.js"), false);
  assert.equal(isAllowedSelfBuildPath("src/app/student-mode/page.jsx"), false);
  assert.equal(isAllowedSelfBuildPath("src/lib/build/source-proposal.mjs"), true);
  assert.equal(isAllowedSelfBuildPath("src/lib/build/self-build-policy.mjs"), false);
  assert.equal(isAllowedSelfBuildPath("src/lib/build/sandbox-policy.mjs"), false);
  assert.equal(isAllowedSelfBuildPath("src/lib/build/github-app.mjs"), false);
  assert.equal(isAllowedSelfBuildPath("src/lib/build/build-engine.mjs"), false);
  assert.equal(isAllowedSelfBuildPath("src/app/student-mode/page.jsx"), false);
  assert.equal(isAllowedSelfBuildPath("src/app/experience-lab/student-tools.jsx"), false);
  assert.equal(isAllowedSelfBuildPath("src/app/auth/callback/route.js"), false);
  assert.equal(isAllowedSelfBuildPath("src/app/api/auth/route.js"), false);
  assert.equal(isAllowedSelfBuildPath("package.json"), false);
  assert.equal(isAllowedSelfBuildPath(".github/workflows/deploy.yml"), false);
});

test("rejects traversal, encoded paths, absolute paths, and unusual separators", () => {
  for (const path of [
    "../src/app/experience-lab/page.jsx",
    "src/app/experience-lab/../../student/page.jsx",
    "src/app/experience-lab/%2e%2e/page.jsx",
    "/src/app/experience-lab/page.jsx",
    "src\\app\\experience-lab\\page.jsx",
    "src/app/experience-lab/./page.jsx",
  ]) assert.equal(isAllowedSelfBuildPath(path), false, path);
});

test("validates a bounded change set against the exact base commit", () => {
  const result = validateSelfBuildChangeSet({
    baseSha,
    files: [{ path: "src/app/experience-lab/page.jsx", content: "export default function Page() {}" }],
  });
  assert.equal(result.baseSha, baseSha);
  assert.equal(result.files.length, 1);
});

test("rejects invalid base commits, duplicate paths, oversized files, and secrets", () => {
  assert.throws(() => validateSelfBuildChangeSet({ baseSha: "main", files: [{ path: "src/app/experience-lab/page.jsx", content: "x" }] }), /base commit/);
  assert.throws(() => validateSelfBuildChangeSet({ baseSha, files: [
    { path: "src/app/experience-lab/page.jsx", content: "x" },
    { path: "src/app/experience-lab/page.jsx", content: "y" },
  ] }), /duplicate/);
  assert.throws(() => validateSelfBuildChangeSet({ baseSha, files: [
    { path: "src/app/experience-lab/page.jsx", content: "x".repeat(1024 * 1024 + 1) },
  ] }), /1 MB/);
  assert.throws(() => validateSelfBuildChangeSet({ baseSha, files: [
    { path: "src/lib/build/example.mjs", content: "const token = 'ghp_abcdefghijklmnopqrstuvwxyz123456';" },
  ] }), /credential/);
});
