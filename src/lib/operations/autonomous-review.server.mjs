import { createGitHubAppClient } from "./github-app-client.server.mjs";
import { evaluateTrustedPullRequest } from "./autonomous-github-evidence.mjs";

/**
 * Server-only composition root for Phase C review.
 * Call from a trusted server route after authenticating an owner/operator.
 * Never serialize or return task payloads, credentials, or raw GitHub responses.
 */
export async function reviewConfiguredAutonomousPullRequest({ task, pullRequestNumber, env = process.env, fetchImpl = fetch }) {
  const github = createGitHubAppClient({ env, fetchImpl });
  const result = await evaluateTrustedPullRequest({ github, task, pullRequestNumber });
  return Object.freeze({
    ok: result.ok,
    errors: result.errors,
    evidence: result.evidence,
  });
}
