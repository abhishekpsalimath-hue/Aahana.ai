import test from "node:test";
import assert from "node:assert/strict";
import { buildAgentReport, getRetryDelaySeconds, parseWorkerResponse } from "./agent-worker.mjs";

test("retry delays grow exponentially and cap at five attempts", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(getRetryDelaySeconds), [15, 30, 60, 120, 240]);
  assert.throws(() => getRetryDelaySeconds(0), RangeError);
  assert.throws(() => getRetryDelaySeconds(6), RangeError);
});

test("report distinguishes queued work from verified worker completion", () => {
  const queued = buildAgentReport({
    tasks: [{ id: "t1", status: "queued", title: "Review", attempts: 0 }],
    generatedAt: "2026-11-19T00:00:00.000Z",
  });
  assert.equal(queued.autonomousStatus, "work_queued_or_running");
  assert.equal(queued.verifiedCompleted, 0);
  assert.equal(queued.counts.queued, 1);
});

test("report counts only completed tasks with saved output and finish timestamp", () => {
  const report = buildAgentReport({
    tasks: [
      { id: "t1", status: "completed", finished_at: "2026-11-19T00:00:00Z", result: { output: "Verified output" } },
      { id: "t2", status: "completed", finished_at: "2026-11-19T00:00:00Z", result: {} },
      { id: "t3", status: "claimed", result: { output: "Not completed" } },
    ],
  });
  assert.equal(report.verifiedCompleted, 1);
  assert.equal(report.autonomousStatus, "worker_activity_verified");
  assert.equal(report.counts.completed, 2);
});

test("report filters unknown statuses and excludes user-private payload fields", () => {
  const report = buildAgentReport({
    tasks: [
      { id: "t1", status: "unknown", title: "Ignore" },
      { id: "t2", status: "blocked", title: "Blocked", prompt: "private prompt", result: { output: "safe output" } },
    ],
  });
  assert.equal(report.tasks.length, 1);
  assert.equal(report.tasks[0].output, "safe output");
  assert.equal("prompt" in report.tasks[0], false);
  assert.equal(report.autonomousStatus, "work_blocked");
});

test("worker response validates schema and only accepts supplied evidence IDs", () => {
  const parsed = parseWorkerResponse(JSON.stringify({
    report: "Observed one verified platform event.",
    evidence_event_ids: ["event-1", "fabricated-event", "event-1"],
  }), ["event-1", "event-2"]);
  assert.equal(parsed.report, "Observed one verified platform event.");
  assert.deepEqual(parsed.evidenceEventIds, ["event-1"]);
  assert.throws(() => parseWorkerResponse("not-json", []), TypeError);
  assert.throws(() => parseWorkerResponse(JSON.stringify({ report: "missing refs" }), []), TypeError);
});


test("report only retains evidence references present in its source-event ledger", () => {
  const report = buildAgentReport({
    tasks: [{
      id: "t1",
      status: "completed",
      finished_at: "2026-11-19T00:00:00Z",
      result: { output: "A claim", evidence_event_ids: ["event-1", "missing-event"] },
    }],
    sourceEvents: [{ id: "event-1", event_type: "test_passed", summary: "Tests passed" }],
  });
  assert.deepEqual(report.tasks[0].evidenceEventIds, ["event-1"]);
  assert.equal(report.sourceEvents.length, 1);
});
