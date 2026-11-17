import test from "node:test";
import assert from "node:assert/strict";
import { completeAuthoredCurricula, getLearningCurriculum, getLearningReadiness, getCatalogueCoverage, getCatalogueCoverageSummary } from "./curriculum-engine.js";

test("authored curricula are discoverable by stable subject ID", () => {
  for (const curriculum of completeAuthoredCurricula) {
    const result = getLearningCurriculum(curriculum.subjectId);
    assert.ok(result, curriculum.subjectId);
    assert.equal(result.title, curriculum.title);
  }
});

test("every authored curriculum has outcomes, sequenced units and assessment", () => {
  for (const curriculum of completeAuthoredCurricula) {
    assert.ok(curriculum.learningOutcomes.length >= 3, curriculum.subjectId);
    assert.ok(curriculum.units.length >= 3, curriculum.subjectId);
    assert.ok(curriculum.units.every((unit) => unit.title && unit.outcomes.length >= 2 && unit.concepts.length >= 3), curriculum.subjectId);
    assert.ok(curriculum.assessment.methods.length >= 3, curriculum.subjectId);
  }
});

test("readiness distinguishes discoverable subjects from authored curricula", () => {
  assert.equal(getLearningReadiness("not-a-real-subject").discovery, "unknown");
  assert.equal(getLearningReadiness("mathematics-algebra").curriculum, "authored");
  assert.equal(getLearningReadiness("mathematics-algebra").lesson, "content-authored-review-required");
});

test("catalogue coverage is calculated per category with a rounded-up half target", () => {
  const coverage = getCatalogueCoverage();
  assert.equal(coverage.length, 23);
  for (const category of coverage) {
    assert.equal(category.required, Math.ceil(category.total / 2));
    assert.ok(category.authored <= category.total);
    assert.equal(category.reached, category.authored >= category.required);
  }
});

test("coverage summary reconciles category and subject totals", () => {
  const summary = getCatalogueCoverageSummary();
  assert.equal(summary.categoryCount, 23);
  assert.equal(summary.subjectCount, 305);
  assert.equal(summary.authoredCount, 24);
  assert.equal(completeAuthoredCurricula.length, 24);
  assert.equal(summary.requiredCount, 156);
  assert.equal(summary.categoriesAtTarget, summary.categories.filter((item) => item.reached).length);
  assert.ok(summary.categories.every((item) => item.authored >= 1));
});
