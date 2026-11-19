import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAutonomousTask, AUTONOMOUS_POLICY_LIMITS } from "./autonomous-policy.mjs";

const task = {
  sourceSha: "a".repeat(40),
  risk: "low",
  allowedPaths: ["src/lib/example/**"],
};
const evidence = {
  changedFiles: [{ path: "src/lib/example/feature.mjs" }],
  patch: "export const safe = true;",
  additions: 1,
  deletions: 0,
  tests: [{ command: "node --test", exitCode: 0 }],
  acceptanceCriteria: [{ met: true, evidence: "test output: 1 passed" }],
};

test("accepts a bounded low-risk change with complete evidence", () => {
  assert.deepEqual(evaluateAutonomousTask(task, evidence), { ok: true, errors: [] });
});

test("rejects missing or mutable source identity and non-low risk", () => {
  assert.equal(evaluateAutonomousTask({ ...task, sourceSha: "main" }, evidence).ok, false);
  assert.equal(evaluateAutonomousTask({ ...task, risk: "medium" }, evidence).ok, false);
});

test("rejects paths outside the allowlist", () => {
  assert.ok(evaluateAutonomousTask(task, { ...evidence, changedFiles: [{ path: "src/app/page.js" }] }).errors.some((e) => e.includes("outside")));
});

test("rejects traversal and absolute paths", () => {
  for (const path of ["../secrets.txt", "/tmp/file", "src/lib/example/../../.env"]) {
    assert.equal(evaluateAutonomousTask(task, { ...evidence, changedFiles: [{ path }] }).ok, false);
  }
});

test("rejects protected workflow, credentials, migration and security paths", () => {
  for (const path of [".github/workflows/build.yml", "src/.env.local", "supabase/migrations/001.sql", "src/auth/session.js", "package-lock.json"]) {
    assert.equal(evaluateAutonomousTask({ ...task, allowedPaths: [path] }, { ...evidence, changedFiles: [{ path }] }).ok, false);
  }
});

test("rejects likely secrets in the patch", () => {
  for (const patch of ["const key = 'ghp_123456789012345678901234567890';", "CRON_SECRET=supersecretvalue123"]) {
    assert.equal(evaluateAutonomousTask(task, { ...evidence, patch }).ok, false);
  }
});

test("rejects oversized patches and change sets", () => {
  assert.equal(evaluateAutonomousTask(task, { ...evidence, patch: "x".repeat(AUTONOMOUS_POLICY_LIMITS.maxPatchBytes + 1) }).ok, false);
  assert.equal(evaluateAutonomousTask(task, { ...evidence, additions: 500, deletions: 1 }).ok, false);
  assert.equal(evaluateAutonomousTask(task, { ...evidence, changedFiles: Array.from({ length: 21 }, (_, i) => ({ path: `src/lib/example/${i}.mjs` })) }).ok, false);
});

test("requires recorded passing test commands", () => {
  assert.equal(evaluateAutonomousTask(task, { ...evidence, tests: [{ command: "npm test", exitCode: 1 }] }).ok, false);
  assert.equal(evaluateAutonomousTask(task, { ...evidence, tests: [] }).ok, false);
});

test("requires every acceptance criterion to be evidenced", () => {
  assert.equal(evaluateAutonomousTask(task, { ...evidence, acceptanceCriteria: [{ met: true, evidence: "" }] }).ok, false);
  assert.equal(evaluateAutonomousTask(task, { ...evidence, acceptanceCriteria: [{ met: false, evidence: "not done" }] }).ok, false);
});
