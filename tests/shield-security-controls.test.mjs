import test from "node:test";
import assert from "node:assert/strict";
import { SECURITY_CONTROLS, SECURITY_CONTROL_GROUPS, getReviewSummary, toggleReviewedControl } from "../src/lib/shield/security-controls.mjs";

test("security catalog has unique ids and evidence for every control", () => {
  const ids = SECURITY_CONTROLS.map((control) => control.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(SECURITY_CONTROLS.every((control) => control.evidence.length >= 3));
});

test("security groups are derived from the control catalog", () => {
  assert.deepEqual(SECURITY_CONTROL_GROUPS, ["All controls", "Identity", "Resilience", "Data protection", "Monitoring"]);
});

test("empty review starts at zero without pre-verified controls", () => {
  assert.deepEqual(getReviewSummary([]), {
    reviewedCount: 0,
    totalCount: 8,
    percentage: 0,
    highPriorityRemaining: 4,
  });
});

test("review summary ignores unknown and duplicate ids", () => {
  assert.deepEqual(getReviewSummary(["mfa", "mfa", "unknown", null]), {
    reviewedCount: 1,
    totalCount: 8,
    percentage: 13,
    highPriorityRemaining: 3,
  });
});

test("toggle adds and removes only known control ids", () => {
  assert.deepEqual(toggleReviewedControl([], "mfa"), ["mfa"]);
  assert.deepEqual(toggleReviewedControl(["mfa"], "mfa"), []);
  assert.deepEqual(toggleReviewedControl(["mfa"], "not-a-control"), ["mfa"]);
});

test("catalog records cannot be mutated accidentally", () => {
  assert.equal(Object.isFrozen(SECURITY_CONTROLS), true);
  assert.equal(Object.isFrozen(SECURITY_CONTROLS[0].evidence), true);
});

test("evidence review records evidence, gaps and notes without claiming verification", async () => {
  const { updateEvidenceReview, getEvidenceReviewSummary } = await import("../src/lib/shield/security-controls.mjs");
  const first = updateEvidenceReview({}, "mfa", { status: "evidence-present", note: "IdP policy export reviewed by owner." });
  assert.equal(first.ok, true);
  const second = updateEvidenceReview(first.reviews, "backup", { status: "gap-found", note: "Restore test is overdue." });
  assert.equal(second.ok, true);
  assert.deepEqual(getEvidenceReviewSummary(second.reviews), {
    evidencePresent: 1, gapsFound: 1, notesAdded: 2, notReviewed: 6, totalCount: 8,
  });
  assert.equal(Object.isFrozen(second.reviews), true);
  assert.equal(Object.isFrozen(second.reviews.backup), true);
});

test("evidence review rejects unknown controls, statuses, extra fields and control characters", async () => {
  const { updateEvidenceReview } = await import("../src/lib/shield/security-controls.mjs");
  assert.equal(updateEvidenceReview({}, "unknown", { status: "gap-found", note: "" }).ok, false);
  assert.equal(updateEvidenceReview({}, "mfa", { status: "verified", note: "" }).ok, false);
  assert.equal(updateEvidenceReview({}, "mfa", { status: "gap-found", note: "", script: "x" }).ok, false);
  assert.equal(updateEvidenceReview({}, "mfa", { status: "gap-found", note: "Owner\nconfirmed" }).ok, false);
  assert.equal(updateEvidenceReview({}, "mfa", { status: "gap-found", note: "x".repeat(501) }).ok, false);
});
