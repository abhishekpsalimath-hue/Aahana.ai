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
    if (typeof file?.filename !== "string" || typeof file.patch !== "string" ||
        !["added", "modified", "removed", "renamed", "copied", "changed"].includes(file.status)) {
      errors.push("every changed file must include a path, supported change status and text patch");
      continue;
    }
    const headMode = headModes.get(file.filename);
    const baseMode = baseModes.get(file.filename);
    const previousPath = typeof file.previousFilename === "string" ? file.previousFilename : "";
    const previousMode = previousPath ? baseModes.get(previousPath) : undefined;

    // Cross-check GitHub's PR file status against both complete Git trees.
    // A path merely appearing in either tree is not enough to authenticate a diff.
    if (file.status === "added" && (baseMode !== undefined || headMode === undefined)) {
      errors.push("added file must be absent from the base tree and present in the head tree");
    } else if (["modified", "changed"].includes(file.status) &&
      (baseMode === undefined || headMode === undefined)) {
      errors.push("modified file must exist in both base and head trees");
    } else if (file.status === "removed" &&
      (baseMode === undefined || headMode !== undefined)) {
      errors.push("removed file must exist in the base tree and be absent from the head tree");
    } else if (file.status === "renamed") {
      if (!previousPath || previousMode === undefined || headMode === undefined) {
        errors.push("renamed file must include a source in the base tree and destination in the head tree");
      }
      if (previousPath && headModes.has(previousPath)) {
        errors.push("renamed source path unexpectedly remains in the head tree");
      }
    } else if (file.status === "copied" && headMode === undefined) {
      errors.push("copied destination must exist in the head tree");
    }

    for (const mode of [headMode, baseMode, previousMode]) {
      if (mode === "120000") errors.push("symbolic-link changes are not eligible for autonomous review");
      if (mode === "160000") errors.push("Git submodule changes are not eligible for autonomous review");
    }
    if (headMode !== undefined || baseMode !== undefined) {
      changedFiles.push({ path: file.filename, mode: headMode || baseMode });
    }
    if (file.status === "renamed" && previousPath) {
      changedFiles.push({ path: previousPath, mode: previousMode });
    }
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
  const criteriaAreValid = criteria.length > 0 && criteria.every((criterion) =>
    criterion !== null && typeof criterion === "object" &&
    typeof criterion.requiredCheckName === "string" &&
    criterion.requiredCheckName.trim().length > 0
  );
  if (!criteriaAreValid) {
    errors.push("task must name required CI checks for every acceptance criterion");
  }
  const acceptanceCriteria = criteriaAreValid ? criteria.map((criterion) => {
    const match = successfulChecks.find((check) => check.name === criterion.requiredCheckName);
    return {
      met: Boolean(match),
      evidence: match ? (match.url || `GitHub check: ${match.name}`) : "",
    };
  }) : [];

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
