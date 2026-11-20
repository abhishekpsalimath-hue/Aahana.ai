import test from "node:test";
import assert from "node:assert/strict";
import { evaluateTrustedPullRequest } from "./autonomous-github-evidence.mjs";

const baseSha = "a".repeat(40);
const headSha = "b".repeat(40);
const task = {
  sourceSha: baseSha,
  risk: "low",
  allowedPaths: ["src/features/demo/**"],
  acceptanceCriteria: [{ id: "unit-tests", requiredCheckName: "Unit tests" }],
};
function makeGithub(overrides = {}) {
  return {
    async getPullRequest() {
      return { state: "open", merged: false, base: { sha: baseSha }, head: { sha: headSha }, ...(overrides.pr || {}) };
    },
    async listPullRequestFiles() {
      return { complete: true, files: [{
        filename: "src/features/demo/hello.mjs", status: "added", patch: "+export const hello = true;",
        additions: 1, deletions: 0,
      }], ...(overrides.files || {}) };
    },
    async getCommitCheckRuns() {
      return { complete: true, checkRuns: [{
        name: "Unit tests", status: "completed", conclusion: "success",
        headSha, url: "https://github.com/example/repo/actions/runs/1",
      }], ...(overrides.checks || {}) };
    },
    async getCommitTree({ sha }) {
      return {
        complete: true, truncated: false,
        entries: sha === baseSha ? [] : [{ path: "src/features/demo/hello.mjs", mode: "100644" }],
        ...(overrides[sha === baseSha ? "baseTree" : "headTree"] || {}),
      };
    },
  };
}

test("accepts only a PR whose base, diff, trees and CI checks are verified", async () => {
  const result = await evaluateTrustedPullRequest({
    github: makeGithub(), task, pullRequestNumber: 12,
  });
  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(result.evidence.headSha, headSha);
});

test("rejects a PR based on a different source SHA", async () => {
  const result = await evaluateTrustedPullRequest({
    github: makeGithub({ pr: { base: { sha: "c".repeat(40) } } }),
    task, pullRequestNumber: 12,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("base")));
});

test("rejects incomplete pagination and truncated Git trees", async () => {
  const incompleteFiles = await evaluateTrustedPullRequest({
    github: makeGithub({ files: { complete: false } }), task, pullRequestNumber: 12,
  });
  assert.equal(incompleteFiles.ok, false);
  const truncatedTree = await evaluateTrustedPullRequest({
    github: makeGithub({ headTree: { truncated: true } }), task, pullRequestNumber: 12,
  });
  assert.equal(truncatedTree.ok, false);
});

test("rejects pending or failed checks", async () => {
  for (const check of [
    { name: "Unit tests", status: "in_progress", conclusion: null, headSha },
    { name: "Unit tests", status: "completed", conclusion: "failure", headSha },
  ]) {
    const result = await evaluateTrustedPullRequest({
      github: makeGithub({ checks: { checkRuns: [check] } }), task, pullRequestNumber: 12,
    });
    assert.equal(result.ok, false);
  }
});

test("rejects symlink changes", async () => {
  const result = await evaluateTrustedPullRequest({
    github: makeGithub({ headTree: { entries: [{ path: "src/features/demo/hello.mjs", mode: "120000" }] } }),
    task, pullRequestNumber: 12,
  });
  assert.equal(result.ok, false);
});

test("rejects missing patches and acceptance-check mappings", async () => {
  const noPatch = await evaluateTrustedPullRequest({
    github: makeGithub({ files: { files: [{ filename: "src/features/demo/hello.mjs", additions: 1, deletions: 0 }] } }),
    task, pullRequestNumber: 12,
  });
  assert.equal(noPatch.ok, false);
  const noCriteria = await evaluateTrustedPullRequest({
    github: makeGithub(), task: { ...task, acceptanceCriteria: [] }, pullRequestNumber: 12,
  });
  assert.equal(noCriteria.ok, false);
});

test("rejects merged or closed pull requests", async () => {
  for (const pr of [{ state: "closed", merged: false }, { state: "closed", merged: true }]) {
    const result = await evaluateTrustedPullRequest({
      github: makeGithub({ pr }), task, pullRequestNumber: 12,
    });
    assert.equal(result.ok, false);
  }
});

test("rejects a rename that moves a protected source path into an allowed folder", async () => {
  const result = await evaluateTrustedPullRequest({
    github: makeGithub({
      files: { files: [{
        filename: "src/features/demo/renamed.mjs",
        previousFilename: ".github/workflows/release.yml",
        status: "renamed",
        patch: "+export const safe = true;",
        additions: 1,
        deletions: 1,
      }] },
      baseTree: { entries: [{ path: ".github/workflows/release.yml", mode: "100644" }] },
      headTree: { entries: [{ path: "src/features/demo/renamed.mjs", mode: "100644" }] },
    }),
    task: { ...task, allowedPaths: ["src/features/demo/**", ".github/workflows/**"] },
    pullRequestNumber: 12,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes(".github/workflows/release.yml")));
});

test("rejects a rename with a missing previous path or symlink source", async () => {
  const missingPrevious = await evaluateTrustedPullRequest({
    github: makeGithub({
      files: { files: [{
        filename: "src/features/demo/renamed.mjs", status: "renamed",
        patch: "+export const safe = true;", additions: 1, deletions: 1,
      }] },
    }),
    task, pullRequestNumber: 12,
  });
  assert.equal(missingPrevious.ok, false);
  const symlinkSource = await evaluateTrustedPullRequest({
    github: makeGithub({
      files: { files: [{
        filename: "src/features/demo/renamed.mjs", previousFilename: "src/features/demo/link",
        status: "renamed", patch: "+export const safe = true;", additions: 1, deletions: 1,
      }] },
      baseTree: { entries: [{ path: "src/features/demo/link", mode: "120000" }] },
      headTree: { entries: [{ path: "src/features/demo/renamed.mjs", mode: "100644" }] },
    }),
    task, pullRequestNumber: 12,
  });
  assert.equal(symlinkSource.ok, false);
});


test("fails closed on malformed acceptance criteria without throwing", async () => {
  for (const acceptanceCriteria of [[null], ["Unit tests"], [{}], [{ requiredCheckName: "   " }]]) {
    const result = await evaluateTrustedPullRequest({
      github: makeGithub(),
      task: { ...task, acceptanceCriteria },
      pullRequestNumber: 12,
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes("acceptance criteria")));
  }
});


test("cross-checks each PR file status against both complete Git trees", async () => {
  const cases = [
    {
      name: "added path already exists in base",
      files: [{ filename: "src/features/demo/hello.mjs", status: "added", patch: "+x", additions: 1, deletions: 0 }],
      baseTree: { entries: [{ path: "src/features/demo/hello.mjs", mode: "100644" }] },
      headTree: { entries: [{ path: "src/features/demo/hello.mjs", mode: "100644" }] },
    },
    {
      name: "modified path missing from head",
      files: [{ filename: "src/features/demo/hello.mjs", status: "modified", patch: "+x", additions: 1, deletions: 0 }],
      baseTree: { entries: [{ path: "src/features/demo/hello.mjs", mode: "100644" }] },
      headTree: { entries: [] },
    },
    {
      name: "removed path still exists in head",
      files: [{ filename: "src/features/demo/hello.mjs", status: "removed", patch: "-x", additions: 0, deletions: 1 }],
      baseTree: { entries: [{ path: "src/features/demo/hello.mjs", mode: "100644" }] },
      headTree: { entries: [{ path: "src/features/demo/hello.mjs", mode: "100644" }] },
    },
    {
      name: "renamed destination missing from head",
      files: [{ filename: "src/features/demo/new.mjs", previousFilename: "src/features/demo/hello.mjs", status: "renamed", patch: "+x", additions: 1, deletions: 1 }],
      baseTree: { entries: [{ path: "src/features/demo/hello.mjs", mode: "100644" }] },
      headTree: { entries: [] },
    },
  ];
  for (const scenario of cases) {
    const result = await evaluateTrustedPullRequest({
      github: makeGithub({
        files: { files: scenario.files },
        baseTree: { entries: scenario.baseTree.entries },
        headTree: { entries: scenario.headTree.entries },
      }),
      task,
      pullRequestNumber: 12,
    });
    assert.equal(result.ok, false, scenario.name);
    assert.ok(result.errors.length > 0, scenario.name);
  }
});

test("rejects Git submodule entries in changed paths", async () => {
  const result = await evaluateTrustedPullRequest({
    github: makeGithub({
      headTree: { entries: [{ path: "src/features/demo/hello.mjs", mode: "160000" }] },
    }),
    task,
    pullRequestNumber: 12,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("submodule")));
});


test("rejects duplicate PR file paths and ambiguous rename sources", async () => {
  const duplicate = await evaluateTrustedPullRequest({
    github: makeGithub({
      files: { files: [
        { filename: "src/features/demo/hello.mjs", status: "added", patch: "+x", additions: 1, deletions: 0 },
        { filename: "src/features/demo/hello.mjs", status: "added", patch: "+x", additions: 1, deletions: 0 },
      ] },
    }), task, pullRequestNumber: 12,
  });
  assert.equal(duplicate.ok, false);
  assert.ok(duplicate.errors.some((error) => error.includes("duplicate")));

  const ambiguousRename = await evaluateTrustedPullRequest({
    github: makeGithub({
      files: { files: [
        { filename: "src/features/demo/new.mjs", previousFilename: "src/features/demo/hello.mjs", status: "renamed", patch: "+x", additions: 1, deletions: 1 },
        { filename: "src/features/demo/hello.mjs", status: "added", patch: "+x", additions: 1, deletions: 0 },
      ] },
      baseTree: { entries: [{ path: "src/features/demo/hello.mjs", mode: "100644" }] },
      headTree: { entries: [
        { path: "src/features/demo/new.mjs", mode: "100644" },
        { path: "src/features/demo/hello.mjs", mode: "100644" },
      ] },
    }), task, pullRequestNumber: 12,
  });
  assert.equal(ambiguousRename.ok, false);
  assert.ok(ambiguousRename.errors.some((error) => error.includes("renamed source")));
});

test("fails closed on unrecognized copied-file status", async () => {
  const result = await evaluateTrustedPullRequest({
    github: makeGithub({
      files: { files: [{
        filename: "src/features/demo/copied.mjs", previousFilename: "src/features/demo/hello.mjs",
        status: "copied", patch: "+x", additions: 1, deletions: 0,
      }] },
      headTree: { entries: [{ path: "src/features/demo/copied.mjs", mode: "100644" }] },
    }), task, pullRequestNumber: 12,
  });
  assert.equal(result.ok, false);
});
