import test from "node:test";
import assert from "node:assert/strict";
import { classifySelfBuildToolFailure, summarizeSelfBuildFailures } from "./failure-classifier.mjs";

test("classifies transient upstream and runtime failures as retryable with bounded recovery advice", () => {
  assert.deepEqual(classifySelfBuildToolFailure("GitHub fetch failed: 503"), { code: "RUNTIME_BUDGET", retryable: true, recoveryAction: "RESTART_WITH_A_SMALLER_TASK" });
  assert.deepEqual(classifySelfBuildToolFailure("upstream returned 429"), { code: "UPSTREAM_UNAVAILABLE", retryable: true, recoveryAction: "RETRY_AFTER_BACKOFF" });
});

test("classifies patch, stale source, scope and context failures as non-retryable", () => {
  assert.equal(classifySelfBuildToolFailure("A patch search must match exactly once").code, "PATCH_NOT_UNIQUE");
  assert.equal(classifySelfBuildToolFailure("The exact source file version changed").code, "STALE_SOURCE");
  assert.equal(classifySelfBuildToolFailure("Path outside the approved plan").code, "SCOPE_VIOLATION");
  assert.equal(classifySelfBuildToolFailure("Combined 180 KB source context limit").code, "CONTEXT_LIMIT");
  assert.equal(classifySelfBuildToolFailure("invalid arguments").retryable, false);
});

test("summarizes only safe failure metadata and caps output", () => {
  const failures = Array.from({ length: 10 }, () => ({ tool: "read_approved_source_file", message: "source context limit" }));
  const result = summarizeSelfBuildFailures(failures);
  assert.equal(result.length, 8);
  assert.equal(result[0].recoveryAction, "REDUCE_FILES_AND_CONTEXT");
  assert.equal("message" in result[0], false);
  assert.throws(() => summarizeSelfBuildFailures([null]), /Each failure/);
});
