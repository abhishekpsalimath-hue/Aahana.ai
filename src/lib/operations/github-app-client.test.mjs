import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { createGitHubAppClient } from "./github-app-client.server.mjs";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const env = {
  AAHANA_GITHUB_REPOSITORY: "owner/repo",
  AAHANA_GITHUB_APP_ID: "12345",
  AAHANA_GITHUB_APP_INSTALLATION_ID: "67890",
  AAHANA_GITHUB_APP_PRIVATE_KEY: privateKey,
};
const baseSha = "a".repeat(40);
const headSha = "b".repeat(40);
function response(data, { ok = true, link = "" } = {}) {
  return { ok, headers: { get(name) { return name.toLowerCase() === "link" ? link : null; } }, async json() { return data; } };
}
function makeFetch() {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("/app/installations/")) return response({ token: "installation-token", expires_at: "2027-01-01T00:00:00Z", permissions: { contents: "read", pull_requests: "read", checks: "read" } });
    if (url.endsWith("/pulls/7")) return response({
      state: "open", merged: false, base: { sha: baseSha }, head: { sha: headSha },
    });
    if (url.includes("/pulls/7/files")) return response([{
      filename: "src/demo.js", patch: "+export default true;", additions: 1, deletions: 0,
    }]);
    if (url.includes("/check-runs")) return response({ check_runs: [{
      name: "Unit tests", status: "completed", conclusion: "success", head_sha: headSha, app: { slug: "github-actions" }, html_url: "https://github.com/owner/repo/actions/runs/1",
    }] });
    if (url.includes("/git/trees/")) return response({
      truncated: false, tree: [{ path: "src/demo.js", mode: "100644" }],
    });
    return response({}, { ok: false });
  };
  return { fetchImpl, calls };
}

test("creates an installation token and uses it only for fixed GitHub API requests", async () => {
  const { fetchImpl, calls } = makeFetch();
  const client = createGitHubAppClient({ env, fetchImpl, now: () => Date.parse("2026-11-20T00:00:00Z") });
  const pr = await client.getPullRequest({ pullRequestNumber: 7 });
  assert.equal(pr.base.sha, baseSha);
  assert.equal(pr.head.sha, headSha);
  assert.equal(calls[0].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].options.body), { permissions: { contents: "read", pull_requests: "read", checks: "read" } });
  assert.match(calls[0].options.headers.Authorization, /^Bearer /);
  const tokenRequest = calls.find((call) => call.url.endsWith("/pulls/7"));
  assert.equal(tokenRequest.options.headers.Authorization, "Bearer installation-token");
  assert.equal(tokenRequest.options.redirect, "error");
});

test("collects pull request files, checks and trees in the evidence adapter shape", async () => {
  const { fetchImpl } = makeFetch();
  const client = createGitHubAppClient({ env, fetchImpl, now: () => Date.parse("2026-11-20T00:00:00Z") });
  const [files, checks, tree] = await Promise.all([
    client.listPullRequestFiles({ pullRequestNumber: 7 }),
    client.getCommitCheckRuns({ sha: headSha }),
    client.getCommitTree({ sha: headSha }),
  ]);
  assert.equal(files.complete, true);
  assert.equal(files.files[0].filename, "src/demo.js");
  assert.equal(checks.checkRuns[0].headSha, headSha);
  assert.equal(checks.checkRuns[0].appSlug, "github-actions");
  assert.equal(tree.entries[0].mode, "100644");
  assert.equal(tree.complete, true);
});

test("reuses the installation token until it approaches expiry", async () => {
  const { fetchImpl, calls } = makeFetch();
  const client = createGitHubAppClient({ env, fetchImpl, now: () => Date.parse("2026-11-20T00:00:00Z") });
  await client.getPullRequest({ pullRequestNumber: 7 });
  await client.getPullRequest({ pullRequestNumber: 7 });
  assert.equal(calls.filter((call) => call.url.includes("/app/installations/")).length, 1);
});

test("fails closed when GitHub App configuration is incomplete", () => {
  assert.throws(() => createGitHubAppClient({ env: {}, fetchImpl: async () => response({}) }), /github_repository_not_configured/);
  assert.throws(() => createGitHubAppClient({ env: { ...env, AAHANA_GITHUB_APP_PRIVATE_KEY: "" }, fetchImpl: async () => response({}) }), /github_app_credentials_not_configured/);
});

test("rejects invalid pull request numbers and mutable commit refs", async () => {
  const { fetchImpl } = makeFetch();
  const client = createGitHubAppClient({ env, fetchImpl, now: () => Date.parse("2026-11-20T00:00:00Z") });
  await assert.rejects(() => client.getPullRequest({ pullRequestNumber: 0 }), /github_pull_request_number_invalid/);
  await assert.rejects(() => client.getCommitTree({ sha: "main" }), /github_commit_sha_invalid/);
  await assert.rejects(() => client.getCommitCheckRuns({ sha: "main" }), /github_commit_sha_invalid/);
});

test("rejects an installation token that grants write permissions", async () => {
  const fetchImpl = async (url) => url.includes("/app/installations/")
    ? response({ token: "installation-token", expires_at: "2027-01-01T00:00:00Z", permissions: { contents: "write", pull_requests: "read", checks: "read" } })
    : response({ state: "open", merged: false, base: { sha: baseSha }, head: { sha: headSha } });
  const client = createGitHubAppClient({ env, fetchImpl, now: () => Date.parse("2026-11-20T00:00:00Z") });
  await assert.rejects(() => client.getPullRequest({ pullRequestNumber: 7 }), /github_installation_token_permissions_invalid/);
});


test("bounds GitHub App token and API requests with abort deadlines", async () => {
  const { fetchImpl, calls } = makeFetch();
  const client = createGitHubAppClient({ env, fetchImpl, now: () => Date.parse("2026-11-20T00:00:00Z") });
  await client.getPullRequest({ pullRequestNumber: 7 });
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.options.signal instanceof AbortSignal));
  assert.equal(calls[0].options.signal.aborted, false);
  assert.equal(calls[1].options.signal.aborted, false);
});
