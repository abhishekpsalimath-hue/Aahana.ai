import { evaluateAutonomousTask } from "./autonomous-policy.mjs";

const FULL_SHA = /^[a-f0-9]{40}$/i;

/**
 * Collects review evidence from a trusted GitHub API adapter.
 *
 * The adapter must use a server-held GitHub credential that is never passed to
 * a sandbox or model. Collection methods must return every page and set
 * complete:true only after pagination has finished.
 */
export async function evaluateTrustedPullRequest({ github, task, pullRequestNumber }) {
  const errors = [];
  if (!github || typeof github !== "object") {
    return { ok: false, errors: ["trusted GitHub adapter is required"] };
  }
  if (!Number.isInteger(pullRequestNumber) || pullRequestNumber < 1) {
    return { ok: false, errors: ["a valid pull request number is required"] };
  }

  const [pr, fileResult] = await Promise.all([
    github.getPullRequest({ pullRequestNumber }),
    github.listPullRequestFiles({ pullRequestNumber }),
  ]);

  if (!pr || pr.state !== "open" || pr.merged === true) {
    return { ok: false, errors: ["pull request must be open and unmerged"] };
  }
  if (!FULL_SHA.test(task?.sourceSha || "") || pr.base?.sha !== task.sourceSha) {
    return { ok: false, errors: ["pull request base does not match the task's immutable source SHA"] };
  }
  if (!FULL_SHA.test(pr.head?.sha || "")) {
    return { ok: false, errors: ["pull request head must be a full immutable commit SHA"] };
  }
  if (!fileResult?.complete || !Array.isArray(fileResult.files) || fileResult.files.length === 0) {
    return { ok: false, errors: ["complete paginated pull request file evidence is required"] };
  }

  const [checkResult, baseTree, headTree] = await Promise.all([
    github.getCommitCheckRuns({ sha: pr.head.sha }),
    github.getCommitTree({ sha: pr.base.sha }),
    github.getCommitTree({ sha: pr.head.sha }),
  ]);

  if (!checkResult?.complete || !Array.isArray(checkResult.checkRuns) || checkResult.checkRuns.length === 0) {
    return { ok: false, errors: ["complete CI check-run evidence is required"] };
  }
  if (!baseTree?.complete || !headTree?.complete || !Array.isArray(baseTree.entries) || !Array.isArray(headTree.entries)) {
    return { ok: false, errors: ["complete base and head Git tree evidence is required"] };
  }
  if (baseTree.truncated === true || headTree.truncated === true) {
    return { ok: false, errors: ["truncated Git trees cannot authorize autonomous changes"] };
  }

  const baseModes = new Map(baseTree.entries.map((entry) => [entry.path, entry.mode]));
  const headModes = new Map(headTree.entries.map((entry) => [entry.path, entry.mode]));
  const changedFiles = [];
  const patches = [];
  let additions = 0;
  let deletions = 0;

  for (const file of fileResult.files) {
    if (typeof file?.filename !== "string" || typeof file.patch !== "string") {
      errors.push("every changed file must include a path and text patch");
      continue;
    }
    const headMode = headModes.get(file.filename);
    const baseMode = baseModes.get(file.filename);
    if (headMode === undefined && baseMode === undefined) {
      errors.push("changed path is absent from both complete Git trees");
    }
    if (headMode === "120000" || baseMode === "120000") {
      errors.push("symbolic-link changes are not eligible for autonomous review");
    }
    changedFiles.push({ path: file.filename, mode: headMode || baseMode });
    patches.push(file.patch);
    if (!Number.isInteger(file.additions) || !Number.isInteger(file.deletions)) {
      errors.push("GitHub file change counts are incomplete");
    } else {
      additions += file.additions;
      deletions += file.deletions;
    }
  }

  const checks = checkResult.checkRuns;
  const successfulChecks = checks.filter((check) =>
    check.status === "completed" && check.conclusion === "success" &&
    check.headSha === pr.head.sha
  );
  const failedOrPending = checks.some((check) =>
    check.status !== "completed" || check.conclusion !== "success"
  );
  if (failedOrPending) errors.push("all reported CI checks must be completed successfully");

  const criteria = Array.isArray(task?.acceptanceCriteria) ? task.acceptanceCriteria : [];
  const acceptanceCriteria = criteria.map((criterion) => {
    const match = successfulChecks.find((check) => check.name === criterion.requiredCheckName);
    return {
      met: Boolean(match),
      evidence: match ? (match.url || `GitHub check: ${match.name}`) : "",
    };
  });
  if (criteria.length === 0 || criteria.some((criterion) => typeof criterion?.requiredCheckName !== "string" || !criterion.requiredCheckName.trim())) {
    errors.push("task must name required CI checks for every acceptance criterion");
  }

  const policy = evaluateAutonomousTask(task, {
    changedFiles,
    patch: patches.join("\n"),
    additions,
    deletions,
    tests: successfulChecks.map((check) => ({
      command: check.name,
      exitCode: 0,
    })),
    acceptanceCriteria,
  });

  return {
    ok: errors.length === 0 && policy.ok,
    errors: [...errors, ...policy.errors],
    evidence: {
      pullRequestNumber,
      baseSha: pr.base.sha,
      headSha: pr.head.sha,
      changedFiles,
      successfulChecks: successfulChecks.map(({ name, url }) => ({ name, url })),
    },
  };
}
