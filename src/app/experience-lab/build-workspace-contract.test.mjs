import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isSafePrivateObjectPath } from "../../lib/build/source-file-policy.mjs";

const page = readFileSync(new URL("./page.jsx", import.meta.url), "utf8");
const buildRoute = readFileSync(new URL("../api/build/project/route.js", import.meta.url), "utf8");
const statusRoute = readFileSync(new URL("../api/build/status/route.js", import.meta.url), "utf8");
const contentRoute = readFileSync(new URL("../api/files/[id]/content/route.js", import.meta.url), "utf8");
const filesRoute = readFileSync(new URL("../api/files/route.js", import.meta.url), "utf8");

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

test("Private file registration rejects ambiguous and traversing storage paths", () => {
  assert.match(filesRoute, /isSafePrivateObjectPath\(objectPath, user\.id, projectId \|\| "personal"\)/);
  assert.match(filesRoute, /projectId !== null && \(typeof projectId !== "string" \|\| !projectId\.trim\(\) \|\| projectId\.length > 128\)/);
  assert.equal(isSafePrivateObjectPath("user-1/project-1/source.js", "user-1", "project-1"), true);
  assert.equal(isSafePrivateObjectPath("user-2/project-1/source.js", "user-1", "project-1"), false);
  assert.equal(isSafePrivateObjectPath("user-1/project-1/../source.js", "user-1", "project-1"), false);
  assert.equal(isSafePrivateObjectPath("user-1/project-1/%2e%2e", "user-1", "project-1"), false);
  assert.equal(isSafePrivateObjectPath("user-1/project-1/a\\\\b.js", "user-1", "project-1"), false);
  assert.equal(isSafePrivateObjectPath("user-1/project-1/\\u0000.js", "user-1", "project-1"), false);
  assert.equal(isSafePrivateObjectPath("user-1/project-1/" + "a".repeat(1025), "user-1", "project-1"), false);
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
  assert.match(contentRoute, /upsert: false/);
});


test("Build Mode preserves failed execution output returned with HTTP 422", () => {
  assert.match(page, /if \(!response\.ok && result\.status !== "failed"\)/);
  assert.match(page, /if \(result\.status === "passed" \|\| result\.status === "failed"\) setBuildResult\(result\)/);
});

test("Source editor uses versioned immutable objects and compare-and-swap metadata updates", () => {
  assert.match(contentRoute, /function versionFor\(objectPath\)/);
  assert.match(contentRoute, /body\.version !== versionFor\(file\.object_path\)/);
  assert.match(contentRoute, /\.eq\("object_path", file\.object_path\)/);
  assert.match(contentRoute, /\.select\("id"\)\.maybeSingle\(\)/);
  assert.match(contentRoute, /status: 409/);
  assert.match(contentRoute, /randomUUID\(\)/);
  assert.match(contentRoute, /acquire_aahana_build_lock/);
  assert.match(contentRoute, /release_aahana_build_lock/);
  assert.match(page, /version: result\.version/);
  assert.match(page, /content: sourceDraft, version: editingFile\.version/);
});

test("AI source proposals are version-bound, reviewed as a diff, and never auto-saved", () => {
  assert.match(page, /validateSourceProposal\(raw/);
  assert.match(page, /createSourceDiff\(sourceDraft, proposal\.updatedContent\)/);
  assert.match(page, /sourceProposal\.baseContent !== sourceDraft/);
  assert.match(page, /disabled=\{proposalBusy \|\| editorSaving\} value=\{sourceDraft\}/);
  assert.match(page, /Ask Aahana to propose an edit/);
  assert.match(page, /projectId: selectedProjectId/);
  assert.match(page, /Use this proposal in editor/);
  assert.match(page, /Nothing is saved until you review the editor and select Save source/);
  assert.match(page, /body: JSON\.stringify\(\{ content: sourceDraft, version: editingFile\.version \}\)/);
  assert.match(page, /AI proposals are limited to source files up to 5 KB/);
  assert.match(page, /instruction\.length > 8000/);
  assert.match(page, /MAX_PROPOSAL_SOURCE_BYTES/);
  assert.match(page, /new AbortController\(\)/);
  assert.match(page, /signal: controller\.signal/);
  assert.match(page, /proposalRequest\.current\?\.abort\(\)/);
  assert.match(page, /Stop proposal/);
});


test("Build workspace assembly fails closed and shares strict source/path validation", () => {
  assert.ok(buildRoute.includes("limit(MAX_PROJECT_FILE_ROWS + 1)"));
  assert.ok(buildRoute.includes("sourceCandidates.length > MAX_SOURCE_FILES"));
  assert.ok(buildRoute.includes("hasInvalidSourceMetadata"));
  assert.ok(buildRoute.includes("isSupportedSourceFile, isSafePrivateObjectPath"));
  assert.ok(buildRoute.includes("isSafePrivateObjectPath(file.object_path, user.id, projectId)"));
  assert.ok(!buildRoute.includes("function isSafePrivateObjectPath"));
  assert.ok(buildRoute.includes("const eligible = sourceCandidates"));
  assert.ok(buildRoute.includes("No partial build was started"));
});


test("Experience Lab aborts active chat, proposal, and build requests when unmounted", () => {
  assert.match(page, /useEffect\(\(\) => \(\) => \{/);
  assert.match(page, /activeRequest\.current\?\.abort\(\)/);
  assert.match(page, /proposalRequest\.current\?\.abort\(\)/);
  assert.match(page, /buildRequest\.current\?\.abort\(\)/);
});

test("Build Mode exposes cancellation for an in-flight isolated execution", () => {
  assert.match(page, /const buildRequest = useRef\(null\)/);
  assert.match(page, /signal: controller\.signal/);
  assert.match(page, /function stopBuildOperation\(\)/);
  assert.match(page, /buildRequest\.current\?\.abort\(\)/);
  assert.match(page, /Stop execution/);
  assert.match(page, /Build execution stopped\. The isolated workspace is being cleaned up\./);
});


test("Failed build logs can be reviewed and handed to Aahana without automatic submission", () => {
  assert.match(page, /function prepareBuildDiagnosis\(\)/);
  assert.match(page, /slice\(0, 4000\)/);
  assert.match(page, /review and remove secrets before sending/);
  assert.match(page, /Prepare diagnosis with Aahana/);
  assert.match(page, /setPrompt\(`Help diagnose this/);
});


test("Source editor rejects stored-size mismatches before returning project content", () => {
  assert.match(contentRoute, /size_bytes/);
  assert.match(contentRoute, /blob\.size !== file\.size_bytes/);
  assert.match(contentRoute, /stored size does not match/);
  assert.match(contentRoute, /status: 409/);
});


test("Build execution diagnostics are returned with private no-store caching", () => {
  assert.match(buildRoute, /Cache-Control": "private, no-store/);
});


test("Build workspace rejects oversized declared source metadata before downloading blobs", () => {
  const metadataGuard = buildRoute.indexOf("const declaredSourceBytes = sourceCandidates.reduce");
  const firstDownload = buildRoute.indexOf("storage.from(\"aahana-private\").download");
  assert.ok(metadataGuard >= 0 && firstDownload > metadataGuard);
  assert.match(buildRoute, /sourceCandidates\.some\(\(file\) => file\.size_bytes > 1024 \* 1024\)/);
  assert.match(buildRoute, /declaredSourceBytes > MAX_SOURCE_BYTES/);
  assert.match(buildRoute, /status: 413/);
});
