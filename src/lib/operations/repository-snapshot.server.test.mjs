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


test("accepts line-wrapped base64 but rejects malformed or non-canonical encodings", async () => {
  const encoded = Buffer.from(source).toString("base64");
  const wrapped = encoded.match(/.{1,8}/g).join("\n");
  const github = makeGithub({ blob: {
    sha: blobSha, size: Buffer.byteLength(source), encoding: "base64", content: wrapped,
  } });
  const files = await collectReadOnlyRepositorySnapshot({
    github, sourceSha, allowedPaths: ["src/index.mjs"],
  });
  assert.equal(files[0].content, source);

  for (const invalid of ["!!!!", "YWJj====", "YQ"]) {
    await assert.rejects(() => collectReadOnlyRepositorySnapshot({
      github: makeGithub({ blob: {
        sha: blobSha, size: Buffer.byteLength(source), encoding: "base64", content: invalid,
      } }),
      sourceSha, allowedPaths: ["src/index.mjs"],
    }), /repository_blob_base64_invalid/);
  }
});

test("rejects Git LFS pointer files instead of passing pointers as source", async () => {
  const pointer = "version https://git-lfs.github.com/spec/v1\n" +
    "oid sha256:" + "a".repeat(64) + "\nsize 4096\n";
  const github = makeGithub({
    entries: [{
      path: "src/index.mjs", mode: "100644", type: "blob", sha: blobSha,
      size: Buffer.byteLength(pointer),
    }],
    blob: {
      sha: blobSha, size: Buffer.byteLength(pointer), encoding: "base64",
      content: Buffer.from(pointer).toString("base64"),
    },
  });
  await assert.rejects(() => collectReadOnlyRepositorySnapshot({
    github, sourceSha, allowedPaths: ["src/index.mjs"],
  }), /git_lfs_pointer_files_are_not_supported/);
});


test("rejects Unicode slash lookalikes, invisible controls, encoded paths and non-NFC names", async () => {
  const github = makeGithub();
  const unsafePaths = [
    "src∕index.mjs", "src／index.mjs", "src⁄index.mjs",
    "src​index.mjs", "src/%2e%2e/.env", "src/name:stream.mjs",
    "src/café.mjs",
  ];
  for (const path of unsafePaths) {
    await assert.rejects(() => collectReadOnlyRepositorySnapshot({
      github, sourceSha, allowedPaths: [path],
    }), /unsafe_repository_snapshot_path/);
  }
  assert.equal(github.calls.length, 0);
});

test("rejects NUL bytes in otherwise valid UTF-8 text", async () => {
  const nulText = Buffer.from([0x65, 0x78, 0x70, 0x6f, 0x72, 0x74, 0x20, 0x00, 0x3b, 0x0a]);
  await assert.rejects(() => collectReadOnlyRepositorySnapshot({
    github: makeGithub({
      entries: [{ path: "src/index.mjs", mode: "100644", type: "blob", sha: blobSha, size: nulText.length }],
      blob: { sha: blobSha, size: nulText.length, encoding: "base64", content: nulText.toString("base64") },
    }),
    sourceSha, allowedPaths: ["src/index.mjs"],
  }), /nul_bytes_in_repository_text_file/);
});
