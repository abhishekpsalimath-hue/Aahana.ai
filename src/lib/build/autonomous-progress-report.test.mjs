import test from "node:test";
import assert from "node:assert/strict";
import { createAutonomousProgressReport, formatAutonomousProgressReportMarkdown } from "./autonomous-progress-report.mjs";

const NOW = "2026-11-28T09:00:00.000Z";
const SHA = "a".repeat(40);
const verifiedTask = {
  taskId: "task-1",
  title: "Improve creative prompt fidelity",
  state: "completed",
  updatedAt: NOW,
  summary: "Added a reviewed prompt-routing improvement.",
  verification: {
    commitSha: SHA,
    verifiedAt: NOW,
    checks: [
      { name: "unit-tests", status: "passed" },
      { name: "production-build", status: "passed" },
    ],
  },
};

test("counts only commit-pinned tasks with passing checks as completed", () => {
  const report = createAutonomousProgressReport({
    date: "2026-11-28",
    generatedAt: NOW,
    tasks: [
      verifiedTask,
      { taskId: "task-2", title: "Daily report UI", state: "in-progress", updatedAt: NOW, summary: "In progress.", verification: null },
      { taskId: "task-3", title: "Approval review", state: "awaiting-owner-review", updatedAt: NOW, summary: "Waiting for owner.", verification: null },
    ],
  });
  assert.equal(report.totals.completedVerified, 1);
  assert.equal(report.totals.inProgress, 1);
  assert.equal(report.totals.awaitingOwnerReview, 1);
  assert.equal(report.totals.completionPercent, 33);
  assert.match(report.headline, /1 of 3 tasks completed and verified/);
});

test("rejects completed work without pinned passing verification", () => {
  assert.throws(() => createAutonomousProgressReport({
    date: "2026-11-28", generatedAt: NOW,
    tasks: [{ ...verifiedTask, verification: null }],
  }), /completed only with passing checks/);
  assert.throws(() => createAutonomousProgressReport({
    date: "2026-11-28", generatedAt: NOW,
    tasks: [{ ...verifiedTask, verification: { ...verifiedTask.verification, checks: [{ name: "tests", status: "failed" }] } }],
  }), /completed only with passing checks/);
});

test("reports blocked, failed, queued and owner-review work as next actions", () => {
  const tasks = ["blocked", "failed", "queued", "awaiting-owner-review"].map((state, index) => ({
    taskId: "task-" + index,
    title: "Task " + state,
    state,
    updatedAt: NOW,
    summary: "",
    verification: null,
  }));
  const report = createAutonomousProgressReport({ date: "2026-11-28", generatedAt: NOW, tasks, blockers: ["Provider test unavailable", "Provider test unavailable"] });
  assert.equal(report.totals.blocked, 1);
  assert.equal(report.totals.failed, 1);
  assert.equal(report.totals.queued, 1);
  assert.equal(report.blockers.length, 1);
  assert.equal(report.nextActions.length, 4);
});

test("rejects duplicate IDs, malformed timestamps, unsafe fields and invalid blockers", () => {
  assert.throws(() => createAutonomousProgressReport({
    date: "2026-11-28", generatedAt: NOW, tasks: [verifiedTask, verifiedTask],
  }), /IDs must be unique/);
  assert.throws(() => createAutonomousProgressReport({ date: "2026-11-28", generatedAt: "not-a-date" }), /canonical report date/);
  assert.throws(() => createAutonomousProgressReport({
    date: "2026-11-28", generatedAt: NOW, tasks: [{ ...verifiedTask, unexpected: true }],
  }), /bounded autonomous progress contract/);
  assert.throws(() => createAutonomousProgressReport({ date: "2026-11-28", generatedAt: NOW, blockers: [""] }), /Blockers must be bounded/);
});

test("bounds report size and deeply freezes the report", () => {
  assert.throws(() => createAutonomousProgressReport({
    date: "2026-11-28", generatedAt: NOW, tasks: Array.from({ length: 101 }, (_, i) => ({
      taskId: "task-" + i, title: "Task " + i, state: "queued", updatedAt: NOW, summary: "", verification: null,
    })),
  }), /at most 100 tasks/);
  const report = createAutonomousProgressReport({ date: "2026-11-28", generatedAt: NOW, tasks: [verifiedTask] });
  assert.equal(Object.isFrozen(report), true);
  assert.equal(Object.isFrozen(report.totals), true);
  assert.equal(Object.isFrozen(report.tasks[0].verification.checks), true);
  assert.equal(report.tasks[0].verifiedCompleted, true);
});

test("an empty report does not invent completed work", () => {
  const report = createAutonomousProgressReport({ date: "2026-11-28", generatedAt: NOW });
  assert.equal(report.totals.total, 0);
  assert.equal(report.totals.completedVerified, 0);
  assert.equal(report.totals.completionPercent, 0);
  assert.match(report.headline, /No task evidence/);
});

test("formats Markdown with verified commits, blockers and next actions", () => {
  const report = createAutonomousProgressReport({
    date: "2026-11-28", generatedAt: NOW,
    tasks: [verifiedTask, { taskId: "task-2", title: "Daily report UI", state: "in-progress", updatedAt: NOW, summary: "Wire reviewed view.", verification: null }],
    blockers: ["Preview quota unavailable"],
  });
  const markdown = formatAutonomousProgressReportMarkdown(report);
  assert.match(markdown, /# Aahana AI — Daily Progress/);
  assert.match(markdown, /1 of 2 tasks completed and verified/);
  assert.match(markdown, /Improve creative prompt fidelity — completed/);
  assert.ok(markdown.includes("Commit: " + String.fromCharCode(96) + "a".repeat(40) + String.fromCharCode(96)));
  assert.match(markdown, /Preview quota unavailable/);
  assert.match(markdown, /Continue the active task: Daily report UI/);
});

test("escapes Markdown supplied in task titles, summaries and blockers", () => {
  const report = createAutonomousProgressReport({
    date: "2026-11-28", generatedAt: NOW,
    tasks: [{ taskId: "safe", title: "Task | [injected] *title*", state: "queued", updatedAt: NOW, summary: "Line one\n# injected heading", verification: null }],
    blockers: ["| [spoofed link](https://example.invalid)"],
  });
  const markdown = formatAutonomousProgressReportMarkdown(report);
  assert.match(markdown, /Task \\| \\[injected\\] \\*title\\*/);
  assert.match(markdown, /\\\\# injected heading/);
  assert.match(markdown, /\\| \\[spoofed link\\]/);
});

test("rejects malformed report input in the Markdown formatter", () => {
  assert.throws(() => formatAutonomousProgressReportMarkdown(null), /normalized autonomous progress report/);
});
