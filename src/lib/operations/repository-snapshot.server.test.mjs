import test from "node:test";
import assert from "node:assert/strict";
import { collectReadOnlyRepositorySnapshot } from "./repository-snapshot.server.mjs";

const sourceSha = "a".repeat(40);
const blobSha = "b".repeat(40);
const source = "export const answer = 42;\n";

function makeGithub({
  entries = [{ path: "src/index.mjs", mode: "100644", type: "blob", sha: blobSha, size: Buffer.byteLength(source) }],
  blob = { sha: blobSha, size: Buffer.byteLength(source), encoding: "base64", content: Buffer.from(source).toString("base64") },
  complete = true,
  truncated = false,
} = {}) {
  const calls = [];
  return {
    calls,
    async getCommitTree(args) {
      calls.push({ method: "tree", ...args });
      return { complete, truncated, entries };
    },
    async getBlob(args) {
      calls.push({ method: "blob", ...args });
      return blob;
    },
  };
}

test("collects only explicit text paths from an immutable commit", async () => {
  const github = makeGithub();
  const files = await collectReadOnlyRepositorySnapshot({
    github, sourceSha, allowedPaths: ["src/index.mjs"],
  });
  assert.deepEqual(files.map(({ path, content }) => ({ path, content })), [
    { path: "src/index.mjs", content: source },
  ]);
  assert.equal(github.calls[0].sha, sourceSha);
  assert.equal(github.calls[1].sha, blobSha);
});

test("rejects mutable refs, duplicate allowlist paths and missing paths", async () => {
  const github = makeGithub();
  await assert.rejects(() => collectReadOnlyRepositorySnapshot({
    github, sourceSha: "main", allowedPaths: ["src/index.mjs"],
  }), /immutable_source_commit_required/);
  await assert.rejects(() => collectReadOnlyRepositorySnapshot({
    github, sourceSha, allowedPaths: ["src/index.mjs", "src/index.mjs"],
  }), /duplicate_repository_allowlist_paths/);
  await assert.rejects(() => collectReadOnlyRepositorySnapshot({
    github, sourceSha, allowedPaths: ["src/missing.mjs"],
  }), /allowlisted_repository_file_missing/);
});

test("rejects incomplete trees, symlinks, submodules and invalid blob metadata", async () => {
  await assert.rejects(() => collectReadOnlyRepositorySnapshot({
    github: makeGithub({ complete: false }), sourceSha, allowedPaths: ["src/index.mjs"],
  }), /complete_repository_tree_required/);
  for (const mode of ["120000", "160000"]) {
    await assert.rejects(() => collectReadOnlyRepositorySnapshot({
      github: makeGithub({ entries: [{ path: "src/index.mjs", mode, type: "blob", sha: blobSha, size: Buffer.byteLength(source) }] }),
      sourceSha, allowedPaths: ["src/index.mjs"],
    }), /non_regular_repository_file_rejected/);
  }
  await assert.rejects(() => collectReadOnlyRepositorySnapshot({
    github: makeGithub({ blob: { sha: "c".repeat(40), size: Buffer.byteLength(source), encoding: "base64", content: Buffer.from(source).toString("base64") } }),
    sourceSha, allowedPaths: ["src/index.mjs"],
  }), /repository_blob_response_mismatch/);
});

test("rejects binary and oversized repository files", async () => {
  const binary = Buffer.from([0xff, 0xfe, 0xfd]);
  await assert.rejects(() => collectReadOnlyRepositorySnapshot({
    github: makeGithub({
      entries: [{ path: "src/index.mjs", mode: "100644", type: "blob", sha: blobSha, size: binary.length }],
      blob: { sha: blobSha, size: binary.length, encoding: "base64", content: binary.toString("base64") },
    }),
    sourceSha, allowedPaths: ["src/index.mjs"],
  }), /binary_repository_files_are_not_supported/);

  await assert.rejects(() => collectReadOnlyRepositorySnapshot({
    github: makeGithub({
      entries: [{ path: "src/index.mjs", mode: "100644", type: "blob", sha: blobSha, size: 1_048_577 }],
    }),
    sourceSha, allowedPaths: ["src/index.mjs"],
  }), /repository_file_size_limit_exceeded/);
});

test("rejects unsafe paths before reading any blob", async () => {
  const github = makeGithub();
  await assert.rejects(() => collectReadOnlyRepositorySnapshot({
    github, sourceSha, allowedPaths: ["../.env"],
  }));
  assert.equal(github.calls.length, 0);
});
