import test from "node:test";
import assert from "node:assert/strict";
import { isClaimedTaskValidForInternalAnalysis } from "./execution-policy.mjs";

const validTask = {
  status: "in_progress",
  approval_required: true,
  approved_at: "2026-11-16T00:00:00.000Z",
  assigned_role: "cto",
  execution_attempts: 1,
};

test("only an atomically claimed, approved task for a known executive can run", () => {
  assert.equal(isClaimedTaskValidForInternalAnalysis(validTask), true);
  assert.equal(isClaimedTaskValidForInternalAnalysis({ ...validTask, status: "approved" }), false);
  assert.equal(isClaimedTaskValidForInternalAnalysis({ ...validTask, approval_required: false }), false);
  assert.equal(isClaimedTaskValidForInternalAnalysis({ ...validTask, approved_at: null }), false);
  assert.equal(isClaimedTaskValidForInternalAnalysis({ ...validTask, assigned_role: "admin" }), false);
});

test("execution attempts are capped at three", () => {
  assert.equal(isClaimedTaskValidForInternalAnalysis({ ...validTask, execution_attempts: 3 }), true);
  assert.equal(isClaimedTaskValidForInternalAnalysis({ ...validTask, execution_attempts: 4 }), false);
  assert.equal(isClaimedTaskValidForInternalAnalysis({ ...validTask, execution_attempts: 0 }), false);
});
