import test from "node:test";
import assert from "node:assert/strict";
import { SECURITY_CONTROLS, SECURITY_CONTROL_GROUPS, getReviewSummary, toggleReviewedControl, updateEvidenceReview, getEvidenceReviewSummary } from "../src/lib/shield/security-controls.mjs";

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

test("evidence review records evidence, gaps and notes without claiming verification", () => {
  const first = updateEvidenceReview({}, "mfa", { status: "evidence-present", note: "IdP policy export reviewed by owner." });
  assert.equal(first.ok, true);
  const second = updateEvidenceReview(first.reviews, "backup", { status: "gap-found", note: "Restore test is overdue." });
  assert.equal(second.ok, true);
  assert.deepEqual(getEvidenceReviewSummary(second.reviews), {
    evidencePresent: 1, gapsFound: 1, notesAdded: 2, remediationAssigned: 0, notReviewed: 6, totalCount: 8,
  });
  assert.equal(Object.isFrozen(second.reviews), true);
  assert.equal(Object.isFrozen(second.reviews.backup), true);
});

test("gap reviews can carry a bounded owner and valid target date", () => {
  const result = updateEvidenceReview({}, "backup", {
    status: "gap-found", note: "Restore test is overdue.",
    remediationOwner: "Operations lead", dueDate: "2026-12-15",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(getEvidenceReviewSummary(result.reviews), {
    evidencePresent: 0, gapsFound: 1, notesAdded: 1, remediationAssigned: 1, notReviewed: 7, totalCount: 8,
  });
  assert.equal(result.reviews.backup.remediationOwner, "Operations lead");
  assert.equal(result.reviews.backup.dueDate, "2026-12-15");
});

test("evidence review rejects unknown controls, statuses, extra fields and unsafe values", () => {
  assert.equal(updateEvidenceReview({}, "unknown", { status: "gap-found", note: "" }).ok, false);
  assert.equal(updateEvidenceReview({}, "mfa", { status: "verified", note: "" }).ok, false);
  assert.equal(updateEvidenceReview({}, "mfa", { status: "gap-found", note: "", script: "x" }).ok, false);
  assert.equal(updateEvidenceReview({}, "mfa", { status: "gap-found", note: "Owner\nconfirmed" }).ok, false);
  assert.equal(updateEvidenceReview({}, "mfa", { status: "gap-found", note: "x".repeat(501) }).ok, false);
  assert.equal(updateEvidenceReview({}, "backup", { status: "gap-found", note: "", remediationOwner: "x".repeat(81) }).ok, false);
  assert.equal(updateEvidenceReview({}, "backup", { status: "gap-found", note: "", dueDate: "2026-02-30" }).ok, false);
});

test("updating one control rebuilds only known safe prior review data", () => {
  const unsafe = {
    mfa: { status: "gap-found", note: "MFA exception", injected: true },
    backup: { status: "gap-found", note: "Restore overdue", remediationOwner: "Ops", dueDate: "2026-12-01" },
    unknown: { status: "evidence-present", note: "ignore" },
  };
  const result = updateEvidenceReview(unsafe, "encrypt", { status: "not-reviewed", note: "" });
  assert.equal(result.ok, true);
  assert.equal(Object.hasOwn(result.reviews, "unknown"), false);
  assert.equal(Object.hasOwn(result.reviews, "mfa"), false);
  assert.deepEqual(result.reviews.backup, {
    status: "gap-found", note: "Restore overdue", remediationOwner: "Ops", dueDate: "2026-12-01",
  });
  assert.equal(Object.isFrozen(result.reviews), true);
});

test("evidence summary ignores malformed and inherited review records", () => {
  const reviews = Object.create({ mfa: { status: "evidence-present", note: "inherited" } });
  reviews.backup = { status: "gap-found", note: "valid" };
  reviews.encrypt = { status: "verified", note: "fake" };
  assert.deepEqual(getEvidenceReviewSummary(reviews), {
    evidencePresent: 0, gapsFound: 1, notesAdded: 1, remediationAssigned: 0, notReviewed: 7, totalCount: 8,
  });
});

test("evidence review safely rejects proxy traps and revoked proxies", () => {
  const hostileRecord = new Proxy({ status: "gap-found", note: "unsafe" }, {
    ownKeys() { throw new Error("blocked ownKeys"); },
  });
  const hostileInput = new Proxy({ status: "gap-found", note: "" }, {
    ownKeys() { throw new Error("blocked ownKeys"); },
  });
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  assert.equal(updateEvidenceReview({}, "mfa", hostileInput).ok, false);
  assert.deepEqual(getEvidenceReviewSummary({ mfa: hostileRecord }), {
    evidencePresent: 0, gapsFound: 0, notesAdded: 0, remediationAssigned: 0, notReviewed: 8, totalCount: 8,
  });
  assert.equal(updateEvidenceReview(revoked.proxy, "mfa", { status: "gap-found", note: "" }).ok, true);
  assert.equal(updateEvidenceReview({}, "mfa", revoked.proxy).ok, false);
  assert.deepEqual(getEvidenceReviewSummary(revoked.proxy), {
    evidencePresent: 0, gapsFound: 0, notesAdded: 0, remediationAssigned: 0, notReviewed: 8, totalCount: 8,
  });
});
