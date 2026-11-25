import test from "node:test";
import assert from "node:assert/strict";
import {
  createStudentTeachingBrief,
  recommendStudentLearningPath,
  STUDENT_GRADE_MAX,
  STUDENT_GRADE_MIN,
  STUDENT_LEARNING_PATHS,
  validateStudentLearningRequest,
  validateStudentProfile,
} from "./student-mode-policy.mjs";

const profile = { grade: 5, language: "Kannada", curriculum: "Karnataka State Board" };

test("Student Mode accepts only grades 1 through 10", () => {
  assert.equal(STUDENT_GRADE_MIN, 1);
  assert.equal(STUDENT_GRADE_MAX, 10);
  for (let grade = 1; grade <= 10; grade += 1) {
    assert.equal(validateStudentProfile({ ...profile, grade }).grade, grade);
  }
  assert.equal(validateStudentProfile({ ...profile, grade: 0 }), null);
  assert.equal(validateStudentProfile({ ...profile, grade: 11 }), null);
  assert.equal(validateStudentProfile({ ...profile, grade: "5" }), null);
});

test("exposes exactly the six supported Student Mode paths", () => {
  assert.deepEqual(STUDENT_LEARNING_PATHS.map((path) => path.id), [
    "story", "visual", "play", "adventure", "talk", "experiment",
  ]);
  assert.equal(new Set(STUDENT_LEARNING_PATHS.map((path) => path.id)).size, 6);
});

test("validates bounded topics and explicit path choices", () => {
  assert.equal(validateStudentLearningRequest({ profile, topic: "Why do stars shine?", preferredPath: "visual" }).preferredPath, "visual");
  assert.equal(validateStudentLearningRequest({ profile, topic: "  " }), null);
  assert.equal(validateStudentLearningRequest({ profile, topic: "A topic", preferredPath: "unknown" }), null);
  assert.equal(validateStudentLearningRequest({ profile: { ...profile, grade: 12 }, topic: "A topic" }), null);
});

test("adapts path choice to progress while respecting learner choice", () => {
  assert.equal(recommendStudentLearningPath({ concepts: [{ status: "needs-review" }] }).recommendedPath, "visual");
  assert.equal(recommendStudentLearningPath({ concepts: [{ status: "secure" }, { status: "secure" }] }).recommendedPath, "adventure");
  assert.equal(recommendStudentLearningPath({ concepts: [{ status: "developing" }] }).recommendedPath, "play");
  assert.equal(recommendStudentLearningPath({ concepts: [] }).recommendedPath, "story");
  assert.equal(recommendStudentLearningPath({ concepts: [{ status: "needs-review" }] }, "talk").recommendedPath, "talk");
  assert.equal(recommendStudentLearningPath({}, "not-a-path"), null);
});

test("creates a grade-adjusted, privacy-conscious teaching brief", () => {
  const brief = createStudentTeachingBrief({ profile, topic: "Fractions", preferredPath: "visual" });
  assert.equal(brief.grade, 5);
  assert.equal(brief.path, "visual");
  assert.match(brief.teachingGuidance, /step-by-step/);
  assert.match(brief.safetyGuidance, /full name/);
  assert.equal(brief.sequence.length, 5);
  assert.equal(createStudentTeachingBrief({ profile: { ...profile, grade: 11 }, topic: "Fractions" }), null);
});
