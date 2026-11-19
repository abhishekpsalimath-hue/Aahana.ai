# Aahana AI — Phase C: isolated engineering worker

## Goal

Allow Aahana to independently implement bounded, low-risk engineering tasks in disposable workspaces, run verification, and propose changes through reviewable pull requests. This is the first phase that qualifies as autonomous code development.

Phase B is not that capability: it only processes bounded system-record analysis tasks. Do not describe Phase B as self-coding.

## Execution boundary

1. The orchestrator creates a typed engineering task with a repository, approved base branch, allowed paths, acceptance criteria, risk class, timeout and resource budget.
2. A fresh disposable sandbox is provisioned for exactly one task. No production environment variables, database credentials, user data, deployment tokens or billing credentials are mounted into it.
3. Source is checked out at an immutable commit. The sandbox receives only the minimum source and dependencies needed for the task.
4. Aahana may edit files and run the approved test/build commands inside the sandbox. It cannot merge, deploy, publish, contact users, change production settings or access user workspaces.
5. The orchestrator captures the diff, command logs, test results, dependency changes and sandbox metadata as immutable task artifacts.
6. A policy gate rejects out-of-scope paths, secrets, unsafe workflow changes, unexpected dependency changes, oversized patches and missing acceptance evidence.
7. A server-side GitHub integration creates a new branch and draft pull request only after validation. Any write credential remains outside the sandbox and is never included in model context or task files.
8. The task report records the sandbox ID, source SHA, resulting commit/PR, tests, failures, artifacts, checkpoint/retry history and approval status.

## Isolation and security requirements

- One task per sandbox; no shared writable filesystem or reused credentials.
- No production secrets, service-role keys, personal access tokens or deployment tokens in the sandbox.
- Network egress disabled by default. Any package-registry access must be explicitly allowlisted and logged.
- No access to cloud metadata endpoints or host credentials.
- Hard limits for runtime, CPU/memory, output size, process count and sandbox lifetime.
- Kill and clean up expired or abandoned sandboxes.
- Treat issue descriptions, repository files, comments, test output and web content as untrusted instructions.
- Prevent prompt injection from changing the task scope or approval policy.
- Scan diffs for secrets, unsafe scripts, permissions changes, migrations, destructive operations and unexpected dependencies.
- Persist append-only task events and checkpoints; never mark a task complete merely because a process exited successfully.

## Approval policy

Aahana may autonomously plan, edit, test, repair and create a draft PR for tasks explicitly classified as low risk and within approved paths.

Founder approval remains mandatory before:
- merging or promoting a change;
- any Production deployment or production configuration change;
- database schema/data migrations against shared or Production environments;
- destructive or irreversible operations;
- enabling paid sandbox/inference services or exceeding an approved resource budget;
- handling sensitive user data or secrets;
- changing authentication, authorization, privacy, billing, payment, or security-critical controls.

## Required acceptance gates

A Phase C task is eligible for a draft PR only when all are true:

- sandbox isolation and cleanup tests pass;
- the task's allowed-path policy passes;
- no secret or policy violation is detected;
- the exact source commit is recorded;
- required tests, lint and build commands complete successfully;
- test and build logs are retained;
- the diff is within configured size limits;
- all acceptance criteria are linked to evidence;
- the task event ledger records completion and artifact references.

A failed or interrupted task must preserve a checkpoint and be retryable without duplicating commits or side effects.

## Provider and cost gate

The repository currently contains no verified, activated Phase C sandbox integration on this branch. The Vercel Sandbox SDK appears in a separate, unmerged workstream and must be reviewed before reuse. Do not provision sandboxes, add paid services, enable provider credentials or change deployment settings until the founder approves the provider, budget and environment.

## Current status

- Phase B implements a gated system-analysis worker and an evidence-based report API.
- Phase B does not edit source code or execute arbitrary code.
- Phase C remains design-only until the sandbox adapter, policy gate, artifact capture, GitHub PR writer and isolation tests are implemented and verified.


## Integration review — 2026-11-19

The separate `work/isolated-workspace-v2` pull request was inspected as a possible provider foundation. It currently implements a user-workspace build/test/run path, not repository self-development:

- It provisions a disposable Vercel Sandbox and writes validated user-submitted files.
- It runs npm build/test scripts or a selected JavaScript/Python entrypoint.
- It denies network access by default and temporarily allows the npm registry for dependency installation, then restores deny-all before running project code.
- It does not check out Aahana's repository, produce a reviewed repository diff, capture immutable development artifacts, enforce a repository-task allowlist, or create a GitHub draft PR.

Therefore, reuse is conditional: extract and independently test the sandbox lifecycle/policy primitives, but do not connect the existing user-project endpoint directly to the autonomous worker.

At this review point, the workspace PR is open and draft, targets `main`, and GitHub reports it as not mergeable. No completed check run was returned for its current head. Its integration and regression status must be rechecked before any shared adoption.

Additional gates before reuse:
- verify sandbox stop/cleanup on timeout, cancellation and provider errors;
- test that package installation cannot execute lifecycle scripts and that project code runs only after egress is denied;
- validate actual CPU, memory, wall-clock and output limits at provider level;
- test path traversal, symlink handling, malicious manifests, oversized output and concurrent requests;
- verify the deployment's Vercel OIDC scope cannot expose unrelated project resources;
- run the sandbox against a disposable test project and approved budget before enabling any paid provider usage.

Until those checks pass, Phase C remains design-only and no provider is activated by this change.
