import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateReleaseEligibility,
  RELEASE_REQUIRED_CHECKS,
} from "./release-policy.mjs";

const passingChecks = Object.fromEntries(RELEASE_REQUIRED_CHECKS.map((name) => [name, true]));

test("blocks every release when any required check is missing or failing", () => {
  for (const changeClass of ["ui", "bugfix", "security"]) {
    const result = evaluateReleaseEligibility({
      changeClass,
      checks: { ...passingChecks, security: false },
      automaticReleaseClasses: ["ui"],
    });
    assert.equal(result.decision, "blocked");
    assert.ok(result.failedChecks.includes("security"));
  }
});

test("keeps automatic release disabled by default", () => {
  const result = evaluateReleaseEligibility({ changeClass: "ui", checks: passingChecks });
  assert.equal(result.decision, "approval-required");
});

test("allows only owner-enabled low-risk classes to become auto-release eligible", () => {
  const result = evaluateReleaseEligibility({
    changeClass: "visual",
    checks: passingChecks,
    automaticReleaseClasses: ["visual", "ui"],
  });
  assert.equal(result.decision, "eligible-for-automatic-release");
});

test("rejects privileged classes in the automatic release policy", () => {
  for (const forbidden of ["bugfix", "feature", "architecture", "reasoning", "auth", "security", "database", "billing", "secrets", "production-config"]) {
    assert.throws(() => evaluateReleaseEligibility({
      changeClass: "ui",
      checks: passingChecks,
      automaticReleaseClasses: [forbidden],
    }));
  }
});

test("requires owner approval for medium-risk changes", () => {
  const pending = evaluateReleaseEligibility({ changeClass: "bugfix", checks: passingChecks });
  const approved = evaluateReleaseEligibility({ changeClass: "bugfix", checks: passingChecks, ownerApproved: true });
  assert.equal(pending.decision, "approval-required");
  assert.equal(approved.decision, "ready-for-owner-release");
});

test("requires owner approval for high and critical changes even if policy is misconfigured", () => {
  for (const changeClass of ["architecture", "reasoning", "auth", "security", "database", "billing", "secrets", "production-config"]) {
    const result = evaluateReleaseEligibility({
      changeClass,
      checks: passingChecks,
      ownerApproved: false,
    });
    assert.equal(result.decision, "approval-required");
  }
});

test("does not let owner approval bypass failed checks", () => {
  const result = evaluateReleaseEligibility({
    changeClass: "security",
    checks: { ...passingChecks, tests: false },
    ownerApproved: true,
  });
  assert.equal(result.decision, "blocked");
});

test("unknown change classes are never auto-released", () => {
  const result = evaluateReleaseEligibility({
    changeClass: "unknown-new-class",
    checks: passingChecks,
    automaticReleaseClasses: ["ui"],
  });
  assert.equal(result.decision, "approval-required");
});

test("requires server-controlled policy and boolean owner approval", () => {
  assert.throws(() => evaluateReleaseEligibility({ changeClass: "ui", checks: passingChecks, automaticReleaseClasses: "ui" }));
  assert.throws(() => evaluateReleaseEligibility({ changeClass: "ui", checks: passingChecks, ownerApproved: "yes" }));
});
