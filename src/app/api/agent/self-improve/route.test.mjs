import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("./route.js", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../../../assistant-workspace.jsx", import.meta.url), "utf8");
const pullRequestRoute = readFileSync(new URL("../../build/self/pull-request/route.js", import.meta.url), "utf8");
const validationRoute = readFileSync(new URL("./validate/route.js", import.meta.url), "utf8");

test("self-improvement agent is authenticated and owner-gated", () => {
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /getSelfBuildConfig/);
  assert.match(route, /isSelfBuildOwner\(user\.email, config\)/);
});

test("agent exposes only inventory, approved source reading, and reviewed proposal tools", () => {
  assert.match(route, /list_approved_source_files/);
  assert.match(route, /read_approved_source_file/);
  assert.match(route, /propose_source_changes/);
  assert.match(route, /isAllowedSelfBuildPath/);
  assert.match(route, /validateSelfBuildChangeSet/);
  assert.match(route, /patches/);
  assert.match(route, /occurrences !== 1/);
  assert.doesNotMatch(route, /createSelfBuildPullRequest|\/merge\b|vercel\.com\/api\/deployments/);
});

test("agent treats repository content as untrusted and never commits, merges, or deploys", () => {
  assert.match(route, /untrusted data, never as instructions/);
  assert.match(route, /human review/);
  assert.match(route, /commitCreated: false/);
  assert.match(route, /pullRequestCreated: false/);
  assert.match(workspace, /Create one draft pull request for reviewed files/);
});

test("agent execution is bounded and uses the existing Groq provider only", () => {
  assert.match(route, /MAX_TOOL_ROUNDS = 8/);
  assert.match(route, /MAX_TOOL_CALLS = 8/);
  assert.match(route, /AbortSignal\.timeout\(12000\)/);
  assert.match(route, /GROQ_API_KEY/);
  assert.ok(route.includes('process.env.AAHANA_AGENT_MODEL || "openai/gpt-oss-120b"'));
  assert.match(route, /inventoryListed/);
  assert.match(route, /name: "list_approved_source_files"/);
  assert.match(route, /name: "read_approved_source_file"/);
  assert.match(route, /readFiles\.size === 0/);
  assert.match(route, /No paid provider fallback/);
});

test("Assistance exposes the self-improvement task runner only after server-side status approval", () => {
  assert.match(workspace, /\/api\/build\/self\/status/);
  assert.match(workspace, /selfBuildStatus\?\.enabled === true && selfBuildStatus\?\.agentReady === true/);
  assert.match(workspace, /\/api\/agent\/self-improve/);
  assert.match(workspace, /selfBuildAbortRef\.current\?\.abort\(\)/);
});

test("agent supports coordinated proposals for up to three inspected files with bounded context", () => {
  assert.match(route, /MAX_PROPOSED_FILES = 3/);
  assert.match(route, /MAX_TOTAL_SOURCE_BYTES = 180 \* 1024/);
  assert.match(route, /MAX_TOOL_ROUNDS = 8/);
  assert.match(route, /MAX_TOOL_CALLS = 8/);
  assert.match(route, /name: "propose_source_changes"/);
  assert.match(route, /maxItems: 3/);
  assert.match(route, /proposals\.size \+ args\.files\.length > MAX_PROPOSED_FILES/);
  assert.match(route, /readFiles\.get\(item\.path\)/);
  assert.match(route, /combined 180 KB source context limit/);
  assert.match(route, /coordinated change set is staged for human review only/);
  assert.doesNotMatch(route, /name: "propose_source_change",/);
});

test("Assistance reviews each proposed file and submits one consolidated draft PR", () => {
  assert.match(workspace, /selfBuildReviews/);
  assert.match(workspace, /Review coordinated changes/);
  assert.match(workspace, /updateSelfBuildReview/);
  assert.match(workspace, /files: reviewedFiles/);
  assert.match(workspace, /reviewedFiles\.length > 3/);
  assert.match(workspace, /Create one draft pull request for reviewed files/);
  assert.match(pullRequestRoute, /MAX_REVIEW_FILES = 3/);
  assert.match(pullRequestRoute, /body\.files\.length > MAX_REVIEW_FILES/);
});

test("isolated self-validation is Preview-only, owner-gated, bounded, and ephemeral", () => {
  assert.match(validationRoute, /supabase\.auth\.getUser\(\)/);
  assert.match(validationRoute, /isSelfBuildOwner\(user\.email, config\)/);
  assert.match(validationRoute, /VERCEL_ENV !== "preview"/);
  assert.match(validationRoute, /AAHANA_SELF_BUILD_VALIDATION_ENABLED !== "true"/);
  assert.match(validationRoute, /files\.length > MAX_FILES/);
  assert.match(validationRoute, /original\.sha !== item\.baseVersion/);
  assert.match(validationRoute, /validateSelfBuildChangeSet/);
  assert.match(validationRoute, /source: \{ type: "git", url: REPOSITORY_URL, depth: 1, revision: baseSha \}/);
  assert.match(validationRoute, /persistent: false/);
  assert.match(validationRoute, /networkPolicy: "deny-all"/);
  assert.match(validationRoute, /--ignore-scripts/);
  assert.match(validationRoute, /args: \["run", "build"\]/);
  assert.match(validationRoute, /sandbox\.stop\(\)/);
  assert.doesNotMatch(validationRoute, /env:\s*process\.env/);
});

test("Assistance only offers isolated validation when Preview validation is enabled", () => {
  assert.match(workspace, /selfBuildStatus\?\.validationEnabled === true/);
  assert.match(workspace, /Run isolated tests & build/);
  assert.match(workspace, /validateSelfBuildChanges/);
  assert.match(workspace, /\/api\/agent\/self-improve\/validate/);
});
