import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, createVerify } from "node:crypto";
import { createGitHubAppJwt, createSelfBuildPullRequest, getSelfBuildRepository } from "./github-app.mjs";

const { privateKey: privateKeyObject, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const env = {
  AAHANA_GITHUB_APP_ID: "12345",
  AAHANA_GITHUB_INSTALLATION_ID: "67890",
  AAHANA_GITHUB_PRIVATE_KEY: privateKeyObject,
  AAHANA_SELF_BUILD_REPOSITORY: "owner/Aahana.ai",
  AAHANA_SELF_BUILD_ALLOWED_EMAILS: "founder@example.com",
  AAHANA_SELF_BUILD_BASE_BRANCH: "main",
};
const baseSha = "a".repeat(40);

function decodeJwtPart(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function mockResponse(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, async text() { return JSON.stringify(data); } };
}

test("creates a short-lived RS256 GitHub App JWT", () => {
  const token = createGitHubAppJwt({ appId: "12345", privateKey: privateKeyObject, now: 1_800_000_000 });
  const [header, payload, signature] = token.split(".");
  assert.deepEqual(decodeJwtPart(header), { alg: "RS256", typ: "JWT" });
  assert.deepEqual(decodeJwtPart(payload), { iat: 1_799_999_940, exp: 1_800_000_540, iss: "12345" });
  const verifier = createVerify("RSA-SHA256");
  verifier.update(header + "." + payload);
  verifier.end();
  assert.equal(verifier.verify(publicKey, signature, "base64url"), true);
});

test("inspects only approved repository source paths at a pinned base commit", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/access_tokens")) return mockResponse({ token: "installation-token" });
    if (url.includes("/git/ref/heads/main")) return mockResponse({ object: { sha: baseSha } });
    if (url.includes("/git/trees/")) return mockResponse({ truncated: false, tree: [
      { type: "blob", path: "src/app/experience-lab/page.jsx", sha: "b".repeat(40), size: 123 },
      { type: "blob", path: "src/app/student-mode/page.jsx", sha: "c".repeat(40), size: 456 },
      { type: "blob", path: "package.json", sha: "d".repeat(40), size: 789 },
    ] });
    throw new Error("Unexpected GitHub request: " + url);
  };
  const result = await getSelfBuildRepository({ env, fetchImpl });
  assert.equal(result.repository, "owner/Aahana.ai");
  assert.equal(result.baseSha, baseSha);
  assert.deepEqual(result.files.map((file) => file.path), ["src/app/experience-lab/page.jsx"]);
  assert.equal(calls.length, 3);
  assert.match(calls[0].options.headers.Authorization, /^Bearer /);
});

test("defaults to main instead of the Preview deployment branch when no explicit base branch is configured", async () => {
  const calls = [];
  const previewEnv = { ...env, AAHANA_SELF_BUILD_BASE_BRANCH: "", VERCEL_GIT_COMMIT_REF: "feat/preview-self-build" };
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.endsWith("/access_tokens")) return mockResponse({ token: "installation-token" });
    if (url.includes("/git/ref/heads/main")) return mockResponse({ object: { sha: baseSha } });
    if (url.includes("/git/trees/")) return mockResponse({ truncated: false, tree: [] });
    throw new Error("Unexpected GitHub request: " + url);
  };
  const result = await getSelfBuildRepository({ env: previewEnv, fetchImpl });
  assert.equal(result.branch, "main");
  assert.ok(calls.some((url) => url.includes("/git/ref/heads/main")));
});

test("creates a draft pull request from a pinned base and never merges or deploys", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ url, method: options.method || "GET", body });
    if (url.endsWith("/access_tokens")) return mockResponse({ token: "installation-token" });
    if (url.includes("/git/ref/heads/main")) return mockResponse({ object: { sha: baseSha } });
    if (url.includes("/git/ref/heads/aahana%2Fself-build%2F")) return mockResponse({}, 404);
    if (url.includes("/git/commits/" + baseSha)) return mockResponse({ tree: { sha: "e".repeat(40) } });
    if (url.endsWith("/git/blobs")) return mockResponse({ sha: "f".repeat(40) });
    if (url.endsWith("/git/trees")) return mockResponse({ sha: "1".repeat(40) });
    if (url.endsWith("/git/commits")) return mockResponse({ sha: "2".repeat(40) });
    if (url.includes("/pulls?state=all")) return mockResponse([]);
    if (url.endsWith("/git/refs")) return mockResponse({ ref: body.ref });
    if (url.endsWith("/pulls")) return mockResponse({ number: 17, html_url: "https://github.com/owner/Aahana.ai/pull/17" });
    throw new Error("Unexpected GitHub request: " + url);
  };
  const result = await createSelfBuildPullRequest({
    baseSha,
    files: [{ path: "src/app/experience-lab/page.jsx", content: "export default function Page() {}" }],
    title: "Improve Build workspace",
    summary: "A focused self-build improvement.",
    env,
    fetchImpl,
  });
  assert.equal(result.number, 17);
  assert.equal(result.baseBranch, "main");
  assert.equal(result.changedFiles, 1);
  const prCall = calls.find((call) => call.url.endsWith("/pulls"));
  assert.equal(prCall.body.draft, true);
  assert.equal(prCall.body.base, "main");
  assert.match(prCall.body.body, /human review only/);
  assert.match(prCall.body.body, /Student Mode/);
  assert.ok(!calls.some((call) => /\/merge(?:\?|$)/.test(call.url)));
});

test("refuses to write when the main branch moved after inspection", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/access_tokens")) return mockResponse({ token: "installation-token" });
    if (url.includes("/pulls?state=all")) return mockResponse([]);
    if (url.includes("/git/ref/heads/main")) return mockResponse({ object: { sha: "b".repeat(40) } });
    throw new Error("A stale base must stop before writes.");
  };
  await assert.rejects(() => createSelfBuildPullRequest({
    baseSha,
    files: [{ path: "src/app/experience-lab/page.jsx", content: "x" }],
    title: "Stale change",
    summary: "Must not be created.",
    env,
    fetchImpl,
  }), /base branch changed/);
});

test("does not report a previously closed proposal as an available draft", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/access_tokens")) return mockResponse({ token: "installation-token" });
    if (url.includes("/pulls?state=all")) {
      const branch = new URL(url).searchParams.get("head").split(":")[1];
      return mockResponse([{
      number: 31,
      state: "closed",
      html_url: "https://github.com/owner/Aahana.ai/pull/31",
      head: { ref: branch, sha: "2".repeat(40) },
      base: { ref: "main" },
    }]);
    }
    throw new Error("A closed proposal must stop before any repository write: " + url);
  };
  await assert.rejects(() => createSelfBuildPullRequest({
    baseSha,
    files: [{ path: "src/app/experience-lab/page.jsx", content: "export default function Page() {}" }],
    title: "Do not reuse closed proposal",
    summary: "Must stop safely.",
    env,
    fetchImpl,
  }), /proposal.*closed/i);
});

test("recovers an interrupted proposal branch only when its exact pinned diff matches", async () => {
  const source = "export default function Page() {}";
  const bytes = Buffer.from(source, "utf8");
  const expectedBlobSha = createHash("sha1").update("blob " + bytes.length + "\0").update(bytes).digest("hex");
  const existingCommitSha = "9".repeat(40);
  const proposalTreeSha = "8".repeat(40);
  const calls = [];
  const fetchImpl = async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ url, method: options.method || "GET", body });
    if (url.endsWith("/access_tokens")) return mockResponse({ token: "installation-token" });
    if (url.includes("/pulls?state=all")) return mockResponse([]);
    if (url.endsWith("/git/ref/heads/main")) return mockResponse({ object: { sha: baseSha } });
    if (url.includes("/git/ref/heads/aahana%2Fself-build%2F")) return mockResponse({ object: { sha: existingCommitSha } });
    if (url.endsWith("/git/commits/" + baseSha)) return mockResponse({ tree: { sha: "e".repeat(40) } });
    if (url.endsWith("/git/commits/" + existingCommitSha)) return mockResponse({
      parents: [{ sha: baseSha }], tree: { sha: proposalTreeSha },
    });
    if (url.includes("/git/trees/" + "e".repeat(40))) return mockResponse({
      truncated: false, tree: [{ type: "blob", mode: "100644", path: "src/app/experience-lab/page.jsx", sha: "b".repeat(40) }],
    });
    if (url.includes("/git/trees/" + proposalTreeSha)) return mockResponse({
      truncated: false, tree: [{ type: "blob", mode: "100644", path: "src/app/experience-lab/page.jsx", sha: expectedBlobSha }],
    });
    if (url.endsWith("/pulls")) return mockResponse({
      number: 29, html_url: "https://github.com/owner/Aahana.ai/pull/29",
    });
    throw new Error("Unexpected GitHub request: " + url);
  };
  const result = await createSelfBuildPullRequest({
    baseSha,
    files: [{ path: "src/app/experience-lab/page.jsx", content: source }],
    title: "Recover interrupted proposal",
    summary: "Resume the exact approved proposal.",
    env,
    fetchImpl,
  });
  assert.equal(result.number, 29);
  assert.equal(result.headSha, existingCommitSha);
  assert.equal(result.reused, undefined);
  assert.equal(calls.filter((call) => call.method === "POST" && !call.url.endsWith("/access_tokens")).length, 1);
  assert.ok(!calls.some((call) => call.url.endsWith("/git/blobs") || call.url.endsWith("/git/refs")));
});

test("refuses to reuse an interrupted branch that contains an unapproved file", async () => {
  const source = "export default function Page() {}";
  const bytes = Buffer.from(source, "utf8");
  const expectedBlobSha = createHash("sha1").update("blob " + bytes.length + "\0").update(bytes).digest("hex");
  const existingCommitSha = "9".repeat(40);
  const proposalTreeSha = "8".repeat(40);
  const fetchImpl = async (url) => {
    if (url.endsWith("/access_tokens")) return mockResponse({ token: "installation-token" });
    if (url.includes("/pulls?state=all")) return mockResponse([]);
    if (url.endsWith("/git/ref/heads/main")) return mockResponse({ object: { sha: baseSha } });
    if (url.includes("/git/ref/heads/aahana%2Fself-build%2F")) return mockResponse({ object: { sha: existingCommitSha } });
    if (url.endsWith("/git/commits/" + baseSha)) return mockResponse({ tree: { sha: "e".repeat(40) } });
    if (url.endsWith("/git/commits/" + existingCommitSha)) return mockResponse({
      parents: [{ sha: baseSha }], tree: { sha: proposalTreeSha },
    });
    if (url.includes("/git/trees/" + "e".repeat(40))) return mockResponse({
      truncated: false, tree: [],
    });
    if (url.includes("/git/trees/" + proposalTreeSha)) return mockResponse({
      truncated: false, tree: [
        { type: "blob", mode: "100644", path: "src/app/experience-lab/page.jsx", sha: expectedBlobSha },
        { type: "blob", mode: "100644", path: "src/lib/build/unapproved.mjs", sha: "7".repeat(40) },
      ],
    });
    throw new Error("Unexpected GitHub request: " + url);
  };
  await assert.rejects(() => createSelfBuildPullRequest({
    baseSha,
    files: [{ path: "src/app/experience-lab/page.jsx", content: source }],
    title: "Reject unsafe branch",
    summary: "Must not create a pull request.",
    env,
    fetchImpl,
  }), /outside the approved file set/);
});

test("does not request an installation token when self-build configuration is absent", async () => {
  let called = false;
  await assert.rejects(() => getSelfBuildRepository({ env: {}, fetchImpl: async () => { called = true; } }), /not configured/);
  assert.equal(called, false);
});


test("refuses to reuse a proposal that changes an approved source file into a symlink", async () => {
  const source = "export default function Page() {}";
  const bytes = Buffer.from(source, "utf8");
  const expectedBlobSha = createHash("sha1").update("blob " + bytes.length + "\0").update(bytes).digest("hex");
  const existingCommitSha = "9".repeat(40);
  const proposalTreeSha = "8".repeat(40);
  const fetchImpl = async (url) => {
    if (url.endsWith("/access_tokens")) return mockResponse({ token: "installation-token" });
    if (url.includes("/pulls?state=all")) return mockResponse([]);
    if (url.endsWith("/git/ref/heads/main")) return mockResponse({ object: { sha: baseSha } });
    if (url.includes("/git/ref/heads/aahana%2Fself-build%2F")) return mockResponse({ object: { sha: existingCommitSha } });
    if (url.endsWith("/git/commits/" + baseSha)) return mockResponse({ tree: { sha: "e".repeat(40) } });
    if (url.endsWith("/git/commits/" + existingCommitSha)) return mockResponse({
      parents: [{ sha: baseSha }], tree: { sha: proposalTreeSha },
    });
    if (url.includes("/git/trees/" + "e".repeat(40))) return mockResponse({
      truncated: false, tree: [{ type: "blob", mode: "100644", path: "src/app/experience-lab/page.jsx", sha: "b".repeat(40) }],
    });
    if (url.includes("/git/trees/" + proposalTreeSha)) return mockResponse({
      truncated: false, tree: [{ type: "blob", mode: "120000", path: "src/app/experience-lab/page.jsx", sha: expectedBlobSha }],
    });
    throw new Error("A symlink proposal must be rejected before pull-request creation: " + url);
  };
  await assert.rejects(() => createSelfBuildPullRequest({
    baseSha,
    files: [{ path: "src/app/experience-lab/page.jsx", content: source }],
    title: "Reject symlink proposal",
    summary: "Must not create a pull request.",
    env,
    fetchImpl,
  }), /exact approved file contents/);
});

test("reuses an existing draft when the exact pinned Self-Build change is retried", async () => {
  const calls = [];
  let existingPullRequest = null;
  let baseRefReads = 0;
  const fetchImpl = async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ url, method: options.method || "GET", body });
    if (url.endsWith("/access_tokens")) return mockResponse({ token: "installation-token" });
    if (url.includes("/git/ref/heads/main")) {
      baseRefReads += 1;
      return mockResponse({ object: { sha: baseRefReads === 1 ? baseSha : "b".repeat(40) } });
    }
    if (url.includes("/git/ref/heads/aahana%2Fself-build%2F")) return mockResponse({}, 404);
    if (url.includes("/pulls?state=all")) return mockResponse(existingPullRequest ? [existingPullRequest] : []);
    if (url.includes("/git/commits/" + baseSha)) return mockResponse({ tree: { sha: "e".repeat(40) } });
    if (url.endsWith("/git/blobs")) return mockResponse({ sha: "f".repeat(40) });
    if (url.endsWith("/git/trees")) return mockResponse({ sha: "1".repeat(40) });
    if (url.endsWith("/git/commits")) return mockResponse({ sha: "2".repeat(40) });
    if (url.endsWith("/git/refs")) return mockResponse({ ref: body.ref });
    if (url.endsWith("/pulls")) {
      existingPullRequest = {
        number: 23,
        state: "open",
        html_url: "https://github.com/owner/Aahana.ai/pull/23",
        head: { ref: body.head, sha: "2".repeat(40) },
        base: { ref: body.base },
      };
      return mockResponse(existingPullRequest);
    }
    throw new Error("Unexpected GitHub request: " + url);
  };
  const input = {
    baseSha,
    files: [{ path: "src/app/experience-lab/page.jsx", content: "export default function Page() {}" }],
    title: "Improve Build workspace",
    summary: "A focused self-build improvement.",
    env,
    fetchImpl,
  };
  const first = await createSelfBuildPullRequest(input);
  const writesAfterFirst = calls.filter((call) => call.method === "POST" && !call.url.endsWith("/access_tokens")).length;
  const second = await createSelfBuildPullRequest(input);
  const writesAfterSecond = calls.filter((call) => call.method === "POST" && !call.url.endsWith("/access_tokens")).length;
  assert.equal(first.number, 23);
  assert.equal(second.number, 23);
  assert.equal(second.reused, true);
  assert.equal(second.branch, first.branch);
  assert.equal(baseRefReads, 1, "a retry reuses its existing draft even if main has since moved");
  assert.equal(writesAfterSecond, writesAfterFirst);
});
