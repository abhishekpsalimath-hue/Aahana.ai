import test from "node:test";
import assert from "node:assert/strict";
import { reviewConfiguredAutonomousPullRequest } from "./autonomous-review.server.mjs";

test("fails closed without GitHub App credentials", async () => {
  await assert.rejects(
    () => reviewConfiguredAutonomousPullRequest({
      task: { sourceSha: "a".repeat(40), risk: "low", allowedPaths: ["src/**"] },
      pullRequestNumber: 1,
      env: {},
      fetchImpl: async () => { throw new Error("must not call network"); },
    }),
    /github_repository_not_configured/,
  );
});
