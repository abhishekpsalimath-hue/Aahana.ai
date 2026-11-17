import test from "node:test";
import assert from "node:assert/strict";
import { SCHOOL_JOURNEY, GRADE_1_MATH, getNextSchoolSubject, isGradeSubjectUnlocked, getGradeOneMathProgress } from "./school-journey.mjs";

test("starts with Grade 1 Mathematics and keeps later subjects locked", () => {
  const next = getNextSchoolSubject({});
  assert.equal(next.gradeId, "grade-1");
  assert.equal(next.subject.id, "mathematics");
  assert.equal(isGradeSubjectUnlocked("grade-1", "mathematics", {}), true);
  assert.equal(isGradeSubjectUnlocked("grade-1", "english", {}), false);
});

test("Grade 1 Mathematics has sequenced, age-appropriate units with knowledge checks", () => {
  assert.equal(GRADE_1_MATH.units.length, 6);
  for (const unit of GRADE_1_MATH.units) {
    assert.ok(unit.teach.length >= 3);
    assert.ok(unit.practice);
    assert.equal(unit.options.length, 3);
    assert.ok(unit.answer >= 0 && unit.answer < unit.options.length);
    assert.ok(unit.explanation);
    assert.equal(unit.checks.length, 3);
    for (const check of unit.checks) {
      assert.equal(check.options.length, 3);
      assert.ok(check.question);
      assert.ok(check.explanation);
      assert.ok(check.answer >= 0 && check.answer < check.options.length);
    }
  }
});

test("next subject unlocks only after the current subject is complete", () => {
  const progress = { "grade-1:mathematics": { complete: true } };
  const next = getNextSchoolSubject(progress);
  assert.equal(next.subject.id, "english");
  assert.equal(isGradeSubjectUnlocked("grade-1", "english", progress), true);
  assert.equal(isGradeSubjectUnlocked("grade-1", "environmental-studies", progress), false);
  assert.equal(isGradeSubjectUnlocked("grade-2", "mathematics", progress), false);
});

test("Grade 2 stays locked until all Grade 1 subjects are completed", () => {
  const progress = {};
  for (const subject of SCHOOL_JOURNEY.grades[0].subjects) {
    progress["grade-1:" + subject.id] = { complete: true };
  }
  assert.equal(isGradeSubjectUnlocked("grade-2", "mathematics", progress), true);
  assert.equal(getNextSchoolSubject(progress).gradeId, "grade-2");
});

test("unit progress is counted independently from subject discovery", () => {
  const units = Object.fromEntries(GRADE_1_MATH.units.slice(0, 2).map((unit) => [unit.id, { complete: true }]));
  const result = getGradeOneMathProgress({ "grade-1:mathematics": { units } });
  assert.equal(result.completedUnits, 2);
  assert.equal(result.totalUnits, 6);
  assert.equal(result.complete, false);
});
