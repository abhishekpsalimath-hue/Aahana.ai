import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GRADE_1_MATHEMATICS_CURRICULUM,
  GRADE_1_ENGLISH_CURRICULUM,
  GRADE_1_EVS_CURRICULUM,
  getGradeLearningCurriculum,
  getGradeCurriculumCoverage
} from "./grade-curriculum.mjs";

test("the interactive counter board is wired into the lesson visual renderer", () => {
  const renderer = readFileSync(new URL("../../app/learn/animated-lesson.jsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../../app/learn/learning-studio.css", import.meta.url), "utf8");
  assert.match(renderer, /"counter-board"/);
  assert.match(renderer, /InteractiveCounterBoard/);
  assert.match(renderer, /aria-label="Add one counter"/);
  assert.match(renderer, /aria-label="Remove one counter"/);
  assert.match(styles, /\.counter-board-track/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
});

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
    if (["counting-to-20", "addition-within-10", "subtraction-within-10"].includes(unit.id)) assert.equal(unit.lessonDesign.visual, "counter-board");
    assert.equal(unit.assessmentDesign.formativeChecks.length, 3);
    assert.ok(unit.assessmentDesign.independentCheck);
    assert.ok(unit.assessmentDesign.feedback);
  }
});

test("grade curriculum is available independently and never gates another subject", () => {
  assert.equal(getGradeLearningCurriculum(1, "Mathematics").grade, 1);
  assert.equal(getGradeLearningCurriculum(1, "Arithmetic").grade, 1);
  assert.equal(getGradeLearningCurriculum(1, "Maths practice").grade, 1);
  assert.equal(getGradeLearningCurriculum(1, "English").grade, 1);
  assert.equal(getGradeLearningCurriculum(1, "English").units.length, 6);
  assert.equal(getGradeLearningCurriculum(1, "EVS").units.length, 6);
  assert.equal(getGradeLearningCurriculum(1, "Environmental Studies").grade, 1);
  assert.equal(getGradeLearningCurriculum(2, "Mathematics"), null);
});

test("Grade 1 English and EVS units contain teachable content and three formative checks", () => {
  for (const curriculum of [GRADE_1_ENGLISH_CURRICULUM, GRADE_1_EVS_CURRICULUM]) {
    assert.equal(curriculum.units.length, 6);
    for (const unit of curriculum.units) {
      assert.ok(unit.title);
      assert.ok(unit.objective);
      assert.ok(Array.isArray(unit.teach) && unit.teach.length >= 3);
      assert.ok(unit.example);
      assert.ok(unit.practice);
      assert.ok(unit.lessonDesign.visual);
      assert.ok(unit.lessonDesign.interaction);
      const checks = unit.checks || unit.assessmentDesign.formativeChecks;
      assert.equal(checks.length, 3);
      for (const check of checks) {
        assert.ok(check.question);
        assert.equal(check.options.length, 3);
        assert.ok(check.answer >= 0 && check.answer < check.options.length);
        assert.ok(check.explanation);
      }
    }
  }
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
