import { createHash, createSign } from "node:crypto";
import { getSelfBuildConfig, isAllowedSelfBuildPath, validateSelfBuildChangeSet } from "./self-build-policy.mjs";

const API = "https://api.github.com";
const API_VERSION = "2022-11-28";

function encodeBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

export function createGitHubAppJwt({ appId, privateKey, now = Math.floor(Date.now() / 1000) }) {
  if (!/^\d+$/.test(String(appId || "")) || typeof privateKey !== "string" || !privateKey.trim()) {
    throw new Error("GitHub App credentials are not configured.");
  }
  const key = privateKey.replace(/\\n/g, "\n");
  const header = encodeBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = encodeBase64Url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: String(appId) }));
  const signingInput = header + "." + payload;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  return signingInput + "." + signer.sign(key).toString("base64url");
}

async function githubRequest(path, token, { fetchImpl = fetch, method = "GET", body } = {}) {
  const response = await fetchImpl(API + path, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": API_VERSION,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch {}
  if (!response.ok) {
    const error = new Error("GitHub repository operation failed (HTTP " + response.status + ").");
    error.status = response.status;
    throw error;
  }
  return data;
}

async function getInstallationToken(config, env, fetchImpl) {
  const jwt = createGitHubAppJwt({
    appId: env.AAHANA_GITHUB_APP_ID,
    privateKey: env.AAHANA_GITHUB_PRIVATE_KEY,
  });
  const installationId = String(env.AAHANA_GITHUB_INSTALLATION_ID);
  const repositoryName = config.repository.split("/")[1];
  const data = await githubRequest(
    "/app/installations/" + encodeURIComponent(installationId) + "/access_tokens",
    jwt,
    { fetchImpl, method: "POST", body: { repositories: [repositoryName] } },
  );
  if (typeof data.token !== "string" || !data.token) {
    throw new Error("GitHub did not issue a repository installation token.");
  }
  return data.token;
}

function repositoryPath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

export async function getSelfBuildRepository({ env = process.env, fetchImpl = fetch } = {}) {
  const config = getSelfBuildConfig(env);
  if (!config.enabled) throw new Error("Aahana self-build is not configured.");
  const token = await getInstallationToken(config, env, fetchImpl);
  const [owner, repo] = config.repository.split("/");
  const branch = String(env.AAHANA_SELF_BUILD_BASE_BRANCH || "main");
  const ref = await githubRequest(
    "/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/git/ref/heads/" + encodeURIComponent(branch),
    token, { fetchImpl },
  );
  const tree = await githubRequest(
    "/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/git/trees/" + encodeURIComponent(ref.object.sha) + "?recursive=1",
    token, { fetchImpl },
  );
  if (tree.truncated) throw new Error("The repository tree is too large to inspect safely.");
  const files = (tree.tree || [])
    .filter((entry) => entry.type === "blob" && isAllowedSelfBuildPath(entry.path))
    .slice(0, 500)
    .map((entry) => ({ path: entry.path, sha: entry.sha, size: entry.size }));
  return { repository: config.repository, branch, baseSha: ref.object.sha, files };
}

export async function getSelfBuildFile({ path, ref, env = process.env, fetchImpl = fetch }) {
  if (!isAllowedSelfBuildPath(path)) throw new Error("This file is outside Aahana's approved self-build scope.");
  const config = getSelfBuildConfig(env);
  if (!config.enabled) throw new Error("Aahana self-build is not configured.");
  const token = await getInstallationToken(config, env, fetchImpl);
  const [owner, repo] = config.repository.split("/");
  const branch = String(env.AAHANA_SELF_BUILD_BASE_BRANCH || "main");
  const data = await githubRequest(
    "/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/contents/" + repositoryPath(path) + "?ref=" + encodeURIComponent(ref || branch),
    token, { fetchImpl },
  );
  if (data.type !== "file" || typeof data.content !== "string" || data.encoding !== "base64") {
    throw new Error("GitHub did not return a supported text source file.");
  }
  const content = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8");
  if (Buffer.byteLength(content, "utf8") > 1024 * 1024 || content.includes("\u0000")) {
    throw new Error("This repository file exceeds the safe text-source limit.");
  }
  return { path, sha: data.sha, content };
}

export async function createSelfBuildPullRequest({
  baseSha, files, title, summary, env = process.env, fetchImpl = fetch,
}) {
  const config = getSelfBuildConfig(env);
  if (!config.enabled) throw new Error("Aahana self-build is not configured.");
  const changeSet = validateSelfBuildChangeSet({ baseSha, files });
  if (typeof title !== "string" || !title.trim() || title.length > 120) {
    throw new Error("A pull request title must be 1–120 characters.");
  }
  if (typeof summary !== "string" || !summary.trim() || summary.length > 5000) {
    throw new Error("A change summary must be 1–5,000 characters.");
  }

  const token = await getInstallationToken(config, env, fetchImpl);
  const [owner, repo] = config.repository.split("/");
  const baseBranch = String(env.AAHANA_SELF_BUILD_BASE_BRANCH || "main");
  const prefix = "/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo);
  const currentRef = await githubRequest(
    prefix + "/git/ref/heads/" + encodeURIComponent(baseBranch), token, { fetchImpl },
  );
  if (currentRef.object?.sha !== changeSet.baseSha) {
    throw new Error("Aahana's base branch changed. Refresh the repository before creating a pull request.");
  }

  // A retried owner action must reuse its existing draft rather than opening
  // another PR for the same exact pinned change set.
  const idempotencyInput = JSON.stringify({
    baseSha: changeSet.baseSha,
    files: [...changeSet.files].sort((a, b) => a.path.localeCompare(b.path)),
  });
  const branch = "aahana/self-build/" + createHash("sha256").update(idempotencyInput).digest("hex").slice(0, 24);
  const existingPullRequests = await githubRequest(
    prefix + "/pulls?state=all&head=" + encodeURIComponent(owner + ":" + branch) + "&base=" + encodeURIComponent(baseBranch),
    token,
    { fetchImpl },
  );
  const existingPullRequest = Array.isArray(existingPullRequests)
    ? existingPullRequests.find((item) => item.head?.ref === branch && item.base?.ref === baseBranch)
    : null;
  if (existingPullRequest) {
    return {
      number: existingPullRequest.number,
      url: existingPullRequest.html_url,
      branch,
      baseBranch,
      baseSha: changeSet.baseSha,
      headSha: existingPullRequest.head?.sha || null,
      changedFiles: changeSet.files.length,
      reused: true,
    };
  }

  const baseCommit = await githubRequest(prefix + "/git/commits/" + changeSet.baseSha, token, { fetchImpl });
  const treeEntries = [];
  for (const file of changeSet.files) {
    const blob = await githubRequest(prefix + "/git/blobs", token, {
      fetchImpl, method: "POST",
      body: { content: Buffer.from(file.content, "utf8").toString("base64"), encoding: "base64" },
    });
    treeEntries.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  const tree = await githubRequest(prefix + "/git/trees", token, {
    fetchImpl, method: "POST",
    body: { base_tree: baseCommit.tree.sha, tree: treeEntries },
  });
  const commit = await githubRequest(prefix + "/git/commits", token, {
    fetchImpl, method: "POST",
    body: {
      message: "Aahana self-build: " + title.trim(),
      tree: tree.sha,
      parents: [changeSet.baseSha],
    },
  });
  await githubRequest(prefix + "/git/refs", token, {
    fetchImpl, method: "POST",
    body: { ref: "refs/heads/" + branch, sha: commit.sha },
  });
  const pullRequest = await githubRequest(prefix + "/pulls", token, {
    fetchImpl, method: "POST",
    body: {
      title: title.trim(),
      head: branch,
      base: baseBranch,
      body: [
        summary.trim(),
        "",
        "---",
        "Created by Aahana Self-Build.",
        "This change is proposed for human review only. It has not been merged or deployed.",
        "Student Mode, authentication, production settings, dependencies, and deployment workflows are outside the approved self-build scope.",
      ].join("\n"),
      draft: true,
    },
  });
  return {
    number: pullRequest.number,
    url: pullRequest.html_url,
    branch,
    baseBranch,
    baseSha: changeSet.baseSha,
    headSha: commit.sha,
    changedFiles: changeSet.files.length,
  };
}
