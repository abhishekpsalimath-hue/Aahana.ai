import { createPrivateKey, createSign } from "node:crypto";

const API_ORIGIN = "https://api.github.com";
const API_VERSION = "2022-11-28";
const MAX_PAGES = 20;
const FULL_SHA = /^[a-f0-9]{40}$/i;

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function parseRepository(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) {
    throw new Error("github_repository_not_configured");
  }
  const [owner, name] = value.split("/");
  return { owner, name };
}

function createAppJwt({ appId, privateKey, now }) {
  const issuedAt = Math.floor(now() / 1000) - 60;
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iat: issuedAt,
    exp: issuedAt + 540,
    iss: appId,
  }));
  const unsigned = header + "." + payload;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return unsigned + "." + signer.sign(privateKey, "base64url");
}

export function createGitHubAppClient({
  env = process.env,
  fetchImpl = fetch,
  now = Date.now,
} = {}) {
  const { owner, name } = parseRepository(env.AAHANA_GITHUB_REPOSITORY);
  const appId = String(env.AAHANA_GITHUB_APP_ID || "");
  const installationId = String(env.AAHANA_GITHUB_APP_INSTALLATION_ID || "");
  const rawKey = String(env.AAHANA_GITHUB_APP_PRIVATE_KEY || "").replaceAll("\\n", "\n");
  if (!/^\d+$/.test(appId) || !/^\d+$/.test(installationId) || !rawKey.includes("PRIVATE KEY")) {
    throw new Error("github_app_credentials_not_configured");
  }

  const privateKey = createPrivateKey(rawKey);
  let cachedToken = null;
  let tokenExpiresAt = 0;

  async function getInstallationToken() {
    if (cachedToken && tokenExpiresAt - now() > 60_000) return cachedToken;
    const jwt = createAppJwt({ appId, privateKey, now });
    const response = await fetchImpl(
      API_ORIGIN + "/app/installations/" + encodeURIComponent(installationId) + "/access_tokens",
      {
        method: "POST",
        redirect: "error",
        headers: {
          Authorization: "Bearer " + jwt,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": API_VERSION,
        },
        body: "{}",
      },
    );
    if (!response.ok) throw new Error("github_installation_token_request_failed");
    const data = await response.json();
    if (typeof data?.token !== "string" || !data.token || typeof data.expires_at !== "string") {
      throw new Error("github_installation_token_response_invalid");
    }
    const expiry = Date.parse(data.expires_at);
    if (!Number.isFinite(expiry) || expiry <= now()) {
      throw new Error("github_installation_token_expiry_invalid");
    }
    cachedToken = data.token;
    tokenExpiresAt = expiry;
    return cachedToken;
  }

  async function getJson(path) {
    if (typeof path !== "string" || !path.startsWith("/repos/") || path.includes("..")) {
      throw new Error("github_api_path_invalid");
    }
    const token = await getInstallationToken();
    const response = await fetchImpl(API_ORIGIN + path, {
      method: "GET",
      redirect: "error",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": API_VERSION,
      },
    });
    if (!response.ok) throw new Error("github_api_request_failed");
    return { data: await response.json(), link: response.headers?.get?.("link") || "" };
  }

  async function getAllPages(path, field) {
    const results = [];
    let page = 1;
    while (page <= MAX_PAGES) {
      const separator = path.includes("?") ? "&" : "?";
      const { data, link } = await getJson(path + separator + "per_page=100&page=" + page);
      const entries = Array.isArray(data) ? data : data?.[field];
      if (!Array.isArray(entries)) return { entries: results, complete: false };
      results.push(...entries);
      if (!/rel="next"/.test(link)) return { entries: results, complete: true };
      page += 1;
    }
    return { entries: results, complete: false };
  }

  return Object.freeze({
    async getPullRequest({ pullRequestNumber }) {
      if (!Number.isInteger(pullRequestNumber) || pullRequestNumber < 1) {
        throw new Error("github_pull_request_number_invalid");
      }
      const { data } = await getJson(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls/${pullRequestNumber}`,
      );
      return {
        state: data.state,
        merged: data.merged === true,
        base: { sha: data.base?.sha },
        head: { sha: data.head?.sha },
      };
    },

    async listPullRequestFiles({ pullRequestNumber }) {
      const result = await getAllPages(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls/${pullRequestNumber}/files`,
        "files",
      );
      return {
        complete: result.complete,
        files: result.entries.map((file) => ({
          filename: file.filename,
          patch: file.patch,
          additions: file.additions,
          deletions: file.deletions,
        })),
      };
    },

    async getCommitCheckRuns({ sha }) {
      if (!FULL_SHA.test(sha || "")) throw new Error("github_commit_sha_invalid");
      const result = await getAllPages(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/commits/${sha}/check-runs`,
        "check_runs",
      );
      return {
        complete: result.complete,
        checkRuns: result.entries.map((check) => ({
          name: check.name,
          status: check.status,
          conclusion: check.conclusion,
          headSha: check.head_sha,
          url: check.html_url,
        })),
      };
    },

    async getCommitTree({ sha }) {
      if (!FULL_SHA.test(sha || "")) throw new Error("github_commit_sha_invalid");
      const { data } = await getJson(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/git/trees/${sha}?recursive=1`,
      );
      return {
        complete: data.truncated !== true && Array.isArray(data.tree),
        truncated: data.truncated === true,
        entries: Array.isArray(data.tree)
          ? data.tree.map((entry) => ({ path: entry.path, mode: entry.mode }))
          : [],
      };
    },
  });
}
