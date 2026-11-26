import test from "node:test";
import assert from "node:assert/strict";
import { createApprovalToken, verifyApprovalToken, APPROVAL_TOKEN_TTL_MS, createValidationToken, verifyValidationToken } from "./approval-token.mjs";

const env = { AAHANA_GITHUB_PRIVATE_KEY: "test-only-approval-signing-key" };
const approved = {
  userId: "owner-1",
  task: "Improve the Assistance workspace",
  pathHint: null,
  plan: { title: "Improve workspace", affectedPaths: ["src/app/experience-lab/page.jsx"] },
  baseSha: "a".repeat(40),
};

test("approval token is valid only for the exact owner, task, plan and base snapshot", () => {
  const now = 1_800_000_000_000;
  const token = createApprovalToken(approved, env, now);
  assert.equal(verifyApprovalToken(token, approved, env, now + 1), true);
  assert.equal(verifyApprovalToken(token, { ...approved, task: "Different task" }, env, now + 1), false);
  assert.equal(verifyApprovalToken(token, { ...approved, userId: "other-owner" }, env, now + 1), false);
  assert.equal(verifyApprovalToken(token, { ...approved, baseSha: "b".repeat(40) }, env, now + 1), false);
  assert.equal(verifyApprovalToken(token, { ...approved, pathHint: "src/app/experience-lab/page.jsx" }, env, now + 1), false);
  assert.equal(verifyApprovalToken(token, { ...approved, plan: { ...approved.plan, title: "Different approved plan" } }, env, now + 1), false);
  assert.equal(verifyApprovalToken(token.slice(0, -1) + (token.endsWith("a") ? "b" : "a"), approved, env, now + 1), false);
  assert.equal(verifyApprovalToken("malformed", approved, env, now + 1), false);
});

test("approval token expires after ten minutes and fails closed without key", () => {
  const now = 1_800_000_000_000;
  const token = createApprovalToken(approved, env, now);
  assert.equal(verifyApprovalToken(token, approved, env, now + APPROVAL_TOKEN_TTL_MS), false);
  assert.equal(verifyApprovalToken(token, approved, {}, now + 1), false);
});

test("validation attestation is bound to owner, base commit and exact proposed file contents", () => {
  const now = 1_800_000_000_000;
  const files = [{ path: "src/app/experience-lab/page.jsx", content: "export default 1;" }];
  const scope = { userId: "owner-1", baseSha: approved.baseSha, files };
  const token = createValidationToken(scope, env, now);
  assert.equal(verifyValidationToken(token, scope, env, now + 1), true);
  assert.equal(verifyValidationToken(token, { ...scope, userId: "other-owner" }, env, now + 1), false);
  assert.equal(verifyValidationToken(token, { ...scope, baseSha: "b".repeat(40) }, env, now + 1), false);
  assert.equal(verifyValidationToken(token, { ...scope, files: [{ ...files[0], content: "tampered" }] }, env, now + 1), false);
  assert.equal(verifyValidationToken(token, scope, env, now + APPROVAL_TOKEN_TTL_MS), false);
});
