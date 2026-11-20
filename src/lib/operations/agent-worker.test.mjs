import test from "node:test";
import assert from "node:assert/strict";
import { buildAgentReport, createWorkerProviderSignal, getRetryDelaySeconds, parseWorkerResponse } from "./agent-worker.mjs";

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
  assert.equal(queued.completedWithSavedOutput, 0);
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
  assert.equal(report.completedWithSavedOutput, 1);
  assert.equal(report.autonomousStatus, "worker_tasks_completed");
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

test("Phase B claim migration limits worker claims to approved executive duties", async () => {
  const { readFile } = await import("node:fs/promises");
  const migration = await readFile(
    new URL("../../../supabase/migrations/20261119190000_aahana_agent_worker_phase_b.sql", import.meta.url),
    "utf8"
  );
  assert.match(migration, /role in \('ceo', 'cto', 'coo', 'cmo'\)/);
  assert.match(migration, /task_type in \('daily_review', 'brain_quality_review', 'health_review', 'growth_review'\)/);
});


test("provider requests inherit caller cancellation and retain a bounded deadline", () => {
  const controller = new AbortController();
  const signal = createWorkerProviderSignal(controller.signal, 45_000);
  assert.equal(signal.aborted, false);
  controller.abort(new Error("caller disconnected"));
  assert.equal(signal.aborted, true);
  assert.equal(signal.reason.message, "caller disconnected");
  assert.throws(() => createWorkerProviderSignal(undefined, 0), RangeError);
  assert.throws(() => createWorkerProviderSignal(undefined, 60_001), RangeError);
});

test("agent worker obtains provider credentials only from server environment and forwards request cancellation", async () => {
  const { readFile } = await import("node:fs/promises");
  const route = await readFile(
    new URL("../../app/api/internal/agent-worker/route.js", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(route, /x-vercel-oidc-token/);
  assert.match(route, /const key = isGroq \? process\.env\.GROQ_API_KEY : process\.env\.VERCEL_OIDC_TOKEN/);
  assert.match(route, /generateInternalDeliverable\(config, task, eventsResult\.data \|\| \[\], priorTasksResult\.data \|\| \[\], request\.signal\)/);
});


test("agent worker releases a claimed lease and returns 499 when the caller disconnects", async () => {
  const { readFile } = await import("node:fs/promises");
  const route = await readFile(
    new URL("../../app/api/internal/agent-worker/route.js", import.meta.url),
    "utf8"
  );
  assert.match(route, /if \(request\.signal\.aborted\) return new Response\(null, \{ status: 499 \}\);\s*\n\s*const \{ data: task, error: claimError \}/);
  assert.match(route, /if \(request\.signal\.aborted\) \{\s*if \(task\) \{[\s\S]*?aahana_fail_agent_task[\s\S]*?p_error_code: "worker_cancelled"[\s\S]*?\}\s*return new Response\(null, \{ status: 499 \}\);/);
  assert.match(route, /if \(request\.signal\.aborted\) throw new Error\("worker_cancelled"\)/);
  assert.match(route, /generateInternalDeliverable\([\s\S]*?request\.signal\);\s*if \(request\.signal\.aborted\) throw new Error\("worker_cancelled"\);\s*const result/);
  assert.match(route, /if \(request\.signal\.aborted\) return new Response\(null, \{ status: 499 \}\);\s*\n\s*return NextResponse\.json\(\{ ok: false, status: "retry_or_blocked"/);
});
