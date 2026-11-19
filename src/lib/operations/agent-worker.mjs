const TASK_STATUSES = new Set(["queued", "claimed", "completed", "blocked", "cancelled"]);

export function getRetryDelaySeconds(attempt) {
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > 5) {
    throw new RangeError("attempt must be an integer from 1 to 5");
  }
  return Math.min(300, 15 * (2 ** (attempt - 1)));
}

export function buildAgentReport({
  runs = [],
  tasks = [],
  events = [],
  generatedAt = new Date().toISOString(),
  windowStart = null,
} = {}) {
  const safeTasks = tasks
    .filter((task) => task && TASK_STATUSES.has(task.status))
    .map((task) => ({
      id: String(task.id || ""),
      runId: String(task.run_id || ""),
      role: String(task.role || "unknown"),
      title: String(task.title || "Untitled task").slice(0, 180),
      status: task.status,
      attempts: Number.isInteger(task.attempts) ? task.attempts : 0,
      errorCode: typeof task.error_code === "string" ? task.error_code : null,
      createdAt: task.created_at || null,
      updatedAt: task.updated_at || null,
      finishedAt: task.finished_at || null,
      output: typeof task.result?.output === "string" ? task.result.output.slice(0, 4000) : null,
      evidenceEventIds: Array.isArray(task.result?.evidence_event_ids)
        ? task.result.evidence_event_ids.filter((id) => typeof id === "string").slice(0, 20)
        : [],
      externalActionsPerformed: task.result?.external_actions_performed === true,
    }));

  const counts = Object.fromEntries(
    [...TASK_STATUSES].map((status) => [status, safeTasks.filter((task) => task.status === status).length])
  );
  const verifiedCompleted = safeTasks.filter((task) =>
    task.status === "completed" && task.finishedAt && task.output
  ).length;
  const pending = counts.queued + counts.claimed;
  const blocked = counts.blocked;

  const safeRuns = runs.slice(0, 10).map((run) => ({
    id: String(run.id || ""),
    cycleKey: String(run.cycle_key || ""),
    status: String(run.status || "unknown"),
    startedAt: run.started_at || null,
    finishedAt: run.finished_at || null,
    summary: typeof run.summary === "string" ? run.summary.slice(0, 500) : null,
    errorCode: typeof run.error_code === "string" ? run.error_code : null,
  }));

  const safeEvents = events.slice(0, 50).map((event) => ({
    id: String(event.id || ""),
    taskId: String(event.task_id || ""),
    runId: String(event.run_id || ""),
    type: String(event.event_type || "unknown"),
    attempt: Number.isInteger(event.attempt) ? event.attempt : 0,
    summary: String(event.summary || "").slice(0, 240),
    createdAt: event.created_at || null,
  }));

  const status = verifiedCompleted > 0
    ? "worker_activity_verified"
    : pending > 0
      ? "work_queued_or_running"
      : blocked > 0
        ? "work_blocked"
        : "no_verified_worker_completion";

  return Object.freeze({
    reportType: "aahana_system_worker_activity",
    generatedAt,
    windowStart,
    autonomousStatus: status,
    verifiedCompleted,
    counts,
    runs: safeRuns,
    tasks: safeTasks,
    events: safeEvents,
    limitations: [
      "This report reflects only system-owned worker task records and audit events.",
      "A completed internal-analysis task does not prove autonomous code development.",
      "No production release or external action is inferred from a task completion.",
    ],
  });
}
