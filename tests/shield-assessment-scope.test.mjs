import test from "node:test";
import assert from "node:assert/strict";
import { validateAssessmentScope, createAssessmentRecord } from "../src/lib/shield/assessment-scope.mjs";

const now = Date.parse("2026-11-28T00:00:00.000Z");
const scope = () => ({
  authorized: true,
  authorizationNote: "I own this domain and authorize a future defensive review.",
  assets: ["example.com", "app.example.com"],
  expiresAt: "2026-12-01T00:00:00.000Z",
});

test("accepts explicit, bounded hostname scope without enabling scans", () => {
  const result = validateAssessmentScope(scope(), now);
  assert.equal(result.valid, true);
  assert.equal(result.normalized.executionEnabled, false);
});
test("requires affirmative authorization and a meaningful note", () => {
  const value = scope(); value.authorized = false; value.authorizationNote = "yes";
  assert.equal(validateAssessmentScope(value, now).valid, false);
});
test("rejects wildcard, URL, path and IP targets", () => {
  for (const asset of ["*.example.com", "https://example.com", "example.com/admin", "127.0.0.1"]) {
    const value = scope(); value.assets = [asset];
    assert.equal(validateAssessmentScope(value, now).valid, false, asset);
  }
});
test("rejects duplicate and excessive target scope", () => {
  const duplicate = scope(); duplicate.assets = ["example.com", "example.com"];
  assert.equal(validateAssessmentScope(duplicate, now).valid, false);
  const excessive = scope(); excessive.assets = Array.from({length:11}, (_, i) => "a" + i + ".example.com");
  assert.equal(validateAssessmentScope(excessive, now).valid, false);
});
test("requires a future expiry within thirty days", () => {
  const value = scope(); value.expiresAt = "2027-01-01T00:00:00.000Z";
  assert.equal(validateAssessmentScope(value, now).valid, false);
});
test("creates a deeply immutable inert assessment record only after valid scope", () => {
  const result = createAssessmentRecord(scope(), { assessmentId: "review_01", now });
  assert.equal(result.ok, true);
  assert.equal(result.record.networkActivity, false);
  assert.deepEqual(result.record.findings, []);
  assert.equal(Object.isFrozen(result.record), true);
  assert.equal(Object.isFrozen(result.record.scope), true);
  assert.equal(Object.isFrozen(result.record.scope.assets), true);
  assert.throws(() => result.record.scope.assets.push("other.example.com"), TypeError);
  assert.equal(createAssessmentRecord(scope(), { assessmentId: "../bad", now }).ok, false);
});
test("rejects malformed, future-dated and stale assessment timestamps", () => {
  for (const createdAt of ["not-a-date", "2026-11-29T00:00:00.000Z", "2026-10-01T00:00:00.000Z"]) {
    assert.equal(createAssessmentRecord(scope(), { assessmentId: "review_02", createdAt, now }).ok, false);
  }
});
