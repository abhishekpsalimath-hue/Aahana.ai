import test from "node:test";
import assert from "node:assert/strict";
import {
  GRADE_1_MATHEMATICS_CURRICULUM,
  getGradeLearningCurriculum,
  getGradeCurriculumCoverage
} from "./grade-curriculum.mjs";

test("Grade 1 Mathematics has a complete six-unit authored core", () => {
  const curriculum = getGradeLearningCurriculum(1, "Mathematics");
  assert.equal(curriculum, GRADE_1_MATHEMATICS_CURRICULUM);
  assert.equal(curriculum.units.length, 6);
  for (const unit of curriculum.units) {
    assert.ok(unit.title);
    assert.ok(unit.objective);
    assert.ok(unit.teach.length >= 3);
    assert.ok(unit.lessonDesign.visual);
    assert.ok(unit.lessonDesign.interaction);
    assert.equal(unit.assessmentDesign.formativeChecks.length, 3);
    assert.ok(unit.assessmentDesign.independentCheck);
    assert.ok(unit.assessmentDesign.feedback);
  }
});

test("grade curriculum is available independently and never gates another subject", () => {
  assert.equal(getGradeLearningCurriculum(1, "Mathematics").grade, 1);
  assert.equal(getGradeLearningCurriculum(1, "English").grade, 1);
  assert.equal(getGradeLearningCurriculum(1, "English").units.length, 6);
  assert.equal(getGradeLearningCurriculum(1, "EVS").units.length, 6);
  assert.equal(getGradeLearningCurriculum(1, "Environmental Studies").grade, 1);
  assert.equal(getGradeLearningCurriculum(2, "Mathematics"), null);
});

test("board alignment is not claimed without a board-specific mapping", () => {
  const { alignment } = GRADE_1_MATHEMATICS_CURRICULUM;
  assert.equal(alignment.status, "board-neutral-core");
  assert.deepEqual(alignment.mappedBoards, []);
  assert.match(alignment.note, /require a separate syllabus-by-syllabus review/i);
});

test("coverage distinguishes authored lessons from board mapping", () => {
  const coverage = getGradeCurriculumCoverage();
  assert.equal(coverage.authored, 18);
  assert.equal(coverage.subjects, 3);
  assert.deepEqual(coverage.units, { mathematics: 6, english: 6, evs: 6 });
  assert.equal(coverage.lessonDesigns, 18);
  assert.equal(coverage.assessmentDesigns, 18);
  assert.equal(coverage.boardMapped, false);
});
