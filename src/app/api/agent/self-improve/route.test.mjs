import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("./route.js", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../../../assistant-workspace.jsx", import.meta.url), "utf8");

test("self-improvement agent is authenticated and owner-gated", () => {
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /getSelfBuildConfig/);
  assert.match(route, /isSelfBuildOwner\(user\.email, config\)/);
});

test("agent exposes only inventory, approved source reading, and reviewed proposal tools", () => {
  assert.match(route, /list_approved_source_files/);
  assert.match(route, /read_approved_source_file/);
  assert.match(route, /propose_source_change/);
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
  assert.match(workspace, /Create draft pull request/);
});

test("agent execution is bounded and uses the existing Groq provider only", () => {
  assert.match(route, /MAX_TOOL_ROUNDS = 4/);
  assert.match(route, /MAX_TOOL_CALLS = 4/);
  assert.match(route, /AbortSignal\.timeout\(12000\)/);
  assert.match(route, /GROQ_API_KEY/);
  assert.match(route, /AAHANA_AGENT_MODEL \|\| "openai\\/gpt-oss-120b"/);
  assert.match(route, /inventoryListed/);
  assert.match(route, /No paid provider fallback/);
});

test("Assistance exposes the self-improvement task runner only after server-side status approval", () => {
  assert.match(workspace, /\/api\/build\/self\/status/);
  assert.match(workspace, /selfBuildStatus\?\.enabled === true && selfBuildStatus\?\.agentReady === true/);
  assert.match(workspace, /\/api\/agent\/self-improve/);
  assert.match(workspace, /selfBuildAbortRef\.current\?\.abort\(\)/);
});
