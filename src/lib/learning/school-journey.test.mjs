import test from "node:test";
import assert from "node:assert/strict";
import { GRADE_1_MATH } from "./school-journey.mjs";

test("Grade 1 Mathematics authoring source contains six complete learning units", () => {
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
