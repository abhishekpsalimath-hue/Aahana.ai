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
  const excessive = scope(); excessive.assets = Array.from({length:11}, (_, i) => `a${i}.example.com`);
  assert.equal(validateAssessmentScope(excessive, now).valid, false);
});
test("requires a future expiry within thirty days", () => {
  const value = scope(); value.expiresAt = "2027-01-01T00:00:00.000Z";
  assert.equal(validateAssessmentScope(value, now).valid, false);
});
test("creates an inert assessment record only after valid scope", () => {
  const result = createAssessmentRecord(scope(), { assessmentId: "review_01" });
  assert.equal(result.ok, true);
  assert.equal(result.record.networkActivity, false);
  assert.deepEqual(result.record.findings, []);
  assert.equal(createAssessmentRecord(scope(), { assessmentId: "../bad" }).ok, false);
});
