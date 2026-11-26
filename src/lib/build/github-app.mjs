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

function gitBlobSha(content) {
  const bytes = Buffer.from(content, "utf8");
  return createHash("sha1")
    .update("blob " + bytes.length + "\0")
    .update(bytes)
    .digest("hex");
}

async function findVerifiedProposalBranch({ prefix, branch, baseSha, baseTreeSha, files, token, fetchImpl }) {
  let ref;
  try {
    ref = await githubRequest(prefix + "/git/ref/heads/" + encodeURIComponent(branch), token, { fetchImpl });
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
  const commitSha = ref.object?.sha;
  if (typeof commitSha !== "string" || !commitSha) {
    throw new Error("An interrupted proposal branch could not be verified safely.");
  }
  const commit = await githubRequest(prefix + "/git/commits/" + encodeURIComponent(commitSha), token, { fetchImpl });
  if (commit.parents?.length !== 1 || commit.parents[0]?.sha !== baseSha) {
    throw new Error("An existing proposal branch does not match the pinned base commit.");
  }
  const [baseTree, proposalTree] = await Promise.all([
    githubRequest(prefix + "/git/trees/" + encodeURIComponent(baseTreeSha) + "?recursive=1", token, { fetchImpl }),
    githubRequest(prefix + "/git/trees/" + encodeURIComponent(commit.tree?.sha || "") + "?recursive=1", token, { fetchImpl }),
  ]);
  if (baseTree.truncated || proposalTree.truncated) {
    throw new Error("An existing proposal branch is too large to verify safely.");
  }
  const baseFiles = new Map((baseTree.tree || []).filter((entry) => entry.type === "blob").map((entry) => [entry.path, entry.mode + ":" + entry.sha]));
  const proposalFiles = new Map((proposalTree.tree || []).filter((entry) => entry.type === "blob").map((entry) => [entry.path, entry.mode + ":" + entry.sha]));
  const changedPaths = new Set([...baseFiles.keys(), ...proposalFiles.keys()]);
  for (const path of changedPaths) {
    if (baseFiles.get(path) === proposalFiles.get(path)) changedPaths.delete(path);
  }
  const expectedPaths = new Set(files.map((file) => file.path));
  if (changedPaths.size !== expectedPaths.size || [...changedPaths].some((path) => !expectedPaths.has(path))) {
    throw new Error("An existing proposal branch contains changes outside the approved file set.");
  }
  for (const file of files) {
    if (proposalFiles.get(file.path) !== "100644:" + gitBlobSha(file.content)) {
      throw new Error("An existing proposal branch does not match the exact approved file contents.");
    }
  }
  return { sha: commitSha };
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
    if (existingPullRequest.state !== "open") {
      throw new Error("An earlier proposal for this exact change set is closed. Prepare a fresh change set instead of reusing a closed draft.");
    }
    const pinnedBaseCommit = await githubRequest(prefix + "/git/commits/" + changeSet.baseSha, token, { fetchImpl });
    const verifiedBranch = await findVerifiedProposalBranch({
      prefix, branch, baseSha: changeSet.baseSha, baseTreeSha: pinnedBaseCommit.tree.sha,
      files: changeSet.files, token, fetchImpl,
    });
    if (!verifiedBranch || existingPullRequest.head?.sha !== verifiedBranch.sha) {
      throw new Error("The existing draft no longer matches the exact approved change set. It was not reused.");
    }
    return {
      number: existingPullRequest.number,
      url: existingPullRequest.html_url,
      branch,
      baseBranch,
      baseSha: changeSet.baseSha,
      headSha: verifiedBranch.sha,
      changedFiles: changeSet.files.length,
      reused: true,
    };
  }

  const currentRef = await githubRequest(
    prefix + "/git/ref/heads/" + encodeURIComponent(baseBranch), token, { fetchImpl },
  );
  if (currentRef.object?.sha !== changeSet.baseSha) {
    throw new Error("Aahana's base branch changed. Refresh the repository before creating a pull request.");
  }

  const baseCommit = await githubRequest(prefix + "/git/commits/" + changeSet.baseSha, token, { fetchImpl });
  let proposalCommit = await findVerifiedProposalBranch({
    prefix, branch, baseSha: changeSet.baseSha, baseTreeSha: baseCommit.tree.sha,
    files: changeSet.files, token, fetchImpl,
  });
  if (!proposalCommit) {
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
    try {
      await githubRequest(prefix + "/git/refs", token, {
        fetchImpl, method: "POST",
        body: { ref: "refs/heads/" + branch, sha: commit.sha },
      });
      proposalCommit = { sha: commit.sha };
    } catch (error) {
      // A concurrent retry may have created the deterministic branch first.
      if (error.status !== 422) throw error;
      proposalCommit = await findVerifiedProposalBranch({
        prefix, branch, baseSha: changeSet.baseSha, baseTreeSha: baseCommit.tree.sha,
        files: changeSet.files, token, fetchImpl,
      });
      if (!proposalCommit) throw error;
    }
  }
  let pullRequest;
  try {
    pullRequest = await githubRequest(prefix + "/pulls", token, {
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
        ].join("\\n"),
        draft: true,
      },
    });
  } catch (error) {
    // Two approved retries can race after the same deterministic branch exists.
    // Reuse the winner only after verifying the PR still points at our exact branch.
    if (error.status !== 422) throw error;
    const racedPullRequests = await githubRequest(
      prefix + "/pulls?state=open&head=" + encodeURIComponent(owner + ":" + branch) + "&base=" + encodeURIComponent(baseBranch),
      token,
      { fetchImpl },
    );
    const racedPullRequest = Array.isArray(racedPullRequests)
      ? racedPullRequests.find((item) => item.state === "open" && item.head?.ref === branch && item.base?.ref === baseBranch)
      : null;
    if (!racedPullRequest) throw error;
    const verifiedBranch = await findVerifiedProposalBranch({
      prefix, branch, baseSha: changeSet.baseSha, baseTreeSha: baseCommit.tree.sha,
      files: changeSet.files, token, fetchImpl,
    });
    if (!verifiedBranch || racedPullRequest.head?.sha !== verifiedBranch.sha || verifiedBranch.sha !== proposalCommit.sha) {
      throw new Error("A concurrent draft proposal could not be verified against the exact approved change set.");
    }
    return {
      number: racedPullRequest.number,
      url: racedPullRequest.html_url,
      branch,
      baseBranch,
      baseSha: changeSet.baseSha,
      headSha: verifiedBranch.sha,
      changedFiles: changeSet.files.length,
      reused: true,
    };
  }
  return {
    number: pullRequest.number,
    url: pullRequest.html_url,
    branch,
    baseBranch,
    baseSha: changeSet.baseSha,
    headSha: proposalCommit.sha,
    changedFiles: changeSet.files.length,
  };
}
