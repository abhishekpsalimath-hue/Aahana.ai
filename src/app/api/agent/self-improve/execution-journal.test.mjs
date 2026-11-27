import test from "node:test";
import assert from "node:assert/strict";
import { createSelfBuildExecutionJournal, startSelfBuildExecutionStep, finishSelfBuildExecutionStep, summarizeSelfBuildExecutionJournal } from "./execution-journal.mjs";

test("records ordered, bounded request-scoped tool steps without source or error content", () => {
  const journal = createSelfBuildExecutionJournal();
  const first = startSelfBuildExecutionStep(journal, "list_approved_source_files");
  finishSelfBuildExecutionStep(journal, first, { ok: true });
  const second = startSelfBuildExecutionStep(journal, "read_approved_source_file");
  finishSelfBuildExecutionStep(journal, second, { ok: false, outcomeCode: "CONTEXT_LIMIT", retryAllowed: false });
  assert.deepEqual(summarizeSelfBuildExecutionJournal(journal), [
    { step: 1, tool: "list_approved_source_files", status: "succeeded", outcomeCode: "TOOL_SUCCEEDED", retryAllowed: false },
    { step: 2, tool: "read_approved_source_file", status: "failed", outcomeCode: "CONTEXT_LIMIT", retryAllowed: false },
  ]);
});

test("rejects invalid tools, duplicate finalization and more than eight steps", () => {
  const journal = createSelfBuildExecutionJournal();
  assert.throws(() => startSelfBuildExecutionStep(journal, "delete_repository"), /Invalid/);
  const step = startSelfBuildExecutionStep(journal, "list_approved_source_files");
  finishSelfBuildExecutionStep(journal, step, { ok: true });
  assert.throws(() => finishSelfBuildExecutionStep(journal, step, { ok: true }), /missing or already/);
  for (let i = 1; i < 8; i++) startSelfBuildExecutionStep(journal, "read_approved_source_file");
  assert.throws(() => startSelfBuildExecutionStep(journal, "read_approved_source_file"), /limit/);
});

test("does not accept arbitrary error text as an outcome code", () => {
  const journal = createSelfBuildExecutionJournal();
  const step = startSelfBuildExecutionStep(journal, "propose_source_changes");
  assert.throws(() => finishSelfBuildExecutionStep(journal, step, { ok: false, outcomeCode: "raw secret error" }), /Invalid/);
});
