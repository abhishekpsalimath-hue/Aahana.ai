const TASK_STATES = new Set(["queued", "in-progress", "blocked", "awaiting-owner-review", "completed", "failed"]);
const CHECK_STATES = new Set(["passed", "failed"]);
const TASK_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const COMMIT_SHA = /^[a-f0-9]{40}$/i;
const MAX_TASKS = 100;
const MAX_CHECKS = 20;
const MAX_BLOCKERS = 50;

function exactObject(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null) &&
    Object.keys(value).sort().join("|") === [...keys].sort().join("|");
}

function isCanonicalTimestamp(value) {
  if (typeof value !== "string") return false;
  try { return new Date(value).toISOString() === value; } catch { return false; }
}

function freezeDeep(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

function normalizeVerification(value) {
  if (value === null) return null;
  if (!exactObject(value, ["commitSha", "verifiedAt", "checks"]) ||
      typeof value.commitSha !== "string" || !COMMIT_SHA.test(value.commitSha) ||
      !isCanonicalTimestamp(value.verifiedAt) ||
      !Array.isArray(value.checks) || value.checks.length < 1 || value.checks.length > MAX_CHECKS) {
    throw new TypeError("Verification must include a pinned commit, canonical timestamp and 1–20 checks.");
  }
  const names = new Set();
  const checks = value.checks.map((check) => {
    if (!exactObject(check, ["name", "status"]) ||
        typeof check.name !== "string" || !check.name.trim() || check.name.length > 120 ||
        !CHECK_STATES.has(check.status)) {
      throw new TypeError("Every verification check needs a bounded name and passed/failed status.");
    }
    if (names.has(check.name)) throw new Error("Verification check names must be unique.");
    names.add(check.name);
    return Object.freeze({ name: check.name.trim(), status: check.status });
  });
  return Object.freeze({
    commitSha: value.commitSha.toLowerCase(),
    verifiedAt: value.verifiedAt,
    checks: Object.freeze(checks),
    passed: checks.every((check) => check.status === "passed"),
  });
}

function normalizeTask(task, seen) {
  if (!exactObject(task, ["taskId", "title", "state", "updatedAt", "summary", "verification"]) ||
      typeof task.taskId !== "string" || !TASK_ID.test(task.taskId) ||
      typeof task.title !== "string" || !task.title.trim() || task.title.length > 160 ||
      !TASK_STATES.has(task.state) || !isCanonicalTimestamp(task.updatedAt) ||
      typeof task.summary !== "string" || task.summary.length > 500) {
    throw new TypeError("Each task must match the bounded autonomous progress contract.");
  }
  if (seen.has(task.taskId)) throw new Error("Progress task IDs must be unique.");
  seen.add(task.taskId);

  const verification = normalizeVerification(task.verification);
  if (task.state === "completed" && (!verification || !verification.passed)) {
    throw new Error("A task can be reported completed only with passing checks tied to a commit.");
  }

  return Object.freeze({
    taskId: task.taskId,
    title: task.title.trim(),
    state: task.state,
    updatedAt: task.updatedAt,
    summary: task.summary.trim(),
    verification,
    verifiedCompleted: task.state === "completed" && verification?.passed === true,
  });
}

/**
 * Build a truthful daily report from supplied autonomous-task evidence.
 * This is a pure reporting contract: it does not schedule work, execute tasks,
 * persist reports, call providers, write repositories, merge or deploy.
 */
export function createAutonomousProgressReport({ date, generatedAt, tasks = [], blockers = [] } = {}) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      new Date(date + "T00:00:00.000Z").toISOString().slice(0, 10) !== date ||
      !isCanonicalTimestamp(generatedAt)) {
    throw new TypeError("A canonical report date and generated-at timestamp are required.");
  }
  if (!Array.isArray(tasks) || tasks.length > MAX_TASKS) {
    throw new RangeError("A daily report may include at most 100 tasks.");
  }
  if (!Array.isArray(blockers) || blockers.length > MAX_BLOCKERS ||
      blockers.some((item) => typeof item !== "string" || !item.trim() || item.length > 300)) {
    throw new TypeError("Blockers must be bounded, non-empty text entries.");
  }

  const seen = new Set();
  const normalizedTasks = tasks.map((task) => normalizeTask(task, seen));
  const totals = {
    total: normalizedTasks.length,
    completedVerified: normalizedTasks.filter((task) => task.verifiedCompleted).length,
    inProgress: normalizedTasks.filter((task) => task.state === "in-progress").length,
    blocked: normalizedTasks.filter((task) => task.state === "blocked").length,
    awaitingOwnerReview: normalizedTasks.filter((task) => task.state === "awaiting-owner-review").length,
    queued: normalizedTasks.filter((task) => task.state === "queued").length,
    failed: normalizedTasks.filter((task) => task.state === "failed").length,
  };
  totals.completionPercent = totals.total ? Math.round((totals.completedVerified / totals.total) * 100) : 0;

  const nextActions = [];
  for (const task of normalizedTasks) {
    if (task.state === "blocked") nextActions.push("Resolve the blocker for: " + task.title);
    else if (task.state === "failed") nextActions.push("Investigate the failed task: " + task.title);
    else if (task.state === "awaiting-owner-review") nextActions.push("Review the pending owner decision for: " + task.title);
    else if (task.state === "in-progress") nextActions.push("Continue the active task: " + task.title);
    else if (task.state === "queued") nextActions.push("Start the queued task when its prerequisites are met: " + task.title);
  }

  return freezeDeep({
    date,
    generatedAt,
    headline: totals.total
      ? totals.completedVerified + " of " + totals.total + " tasks completed and verified."
      : "No task evidence was supplied for this reporting period.",
    totals,
    tasks: normalizedTasks,
    blockers: [...new Set(blockers.map((item) => item.trim()))],
    nextActions,
    scope: "Daily progress report from supplied task/check evidence only; no task execution, scheduling, persistence, provider calls, repository writes, merge or deployment.",
    completionPolicy: "Only tasks with passing checks tied to a pinned commit count as completed. Proposals, drafts and unverified work are not counted as complete.",
  });
}

function markdownText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\x60/g, "\\x60")
    .replace(/([*_{}[\]()#+.!|>~-])/g, "\\$1")
    .replace(/[\r\n]+/g, " ");
}

/** Deterministic, side-effect-free Markdown export for a normalized report. */
export function formatAutonomousProgressReportMarkdown(report) {
  if (!report || typeof report !== "object" || !report.totals ||
      !Array.isArray(report.tasks) || !Array.isArray(report.blockers) ||
      !Array.isArray(report.nextActions) || typeof report.date !== "string" ||
      typeof report.generatedAt !== "string" || typeof report.headline !== "string") {
    throw new TypeError("A normalized autonomous progress report is required.");
  }
  const lines = [
    "# Aahana AI — Daily Progress", "",
    "**Date:** " + markdownText(report.date) + "  ",
    "**Generated:** " + markdownText(report.generatedAt), "",
    "## " + markdownText(report.headline), "", "### Overview", "",
    "- Completed and verified: **" + report.totals.completedVerified + "**",
    "- In progress: **" + report.totals.inProgress + "**",
    "- Blocked: **" + report.totals.blocked + "**",
    "- Awaiting owner review: **" + report.totals.awaitingOwnerReview + "**",
    "- Queued: **" + report.totals.queued + "**",
    "- Failed: **" + report.totals.failed + "**",
    "- Completion: **" + report.totals.completionPercent + "%**", "",
    "### Task details", ""
  ];
  if (report.tasks.length === 0) lines.push("_No task evidence supplied._", "");
  for (const task of report.tasks) {
    lines.push("#### " + markdownText(task.title) + " — " + markdownText(task.state));
    if (task.summary) lines.push(markdownText(task.summary));
    if (task.verification) {
      const tick = String.fromCharCode(96);
      lines.push(
        "- Commit: " + tick + task.verification.commitSha + tick,
        "- Verified: " + markdownText(task.verification.verifiedAt),
        "- Checks: " + task.verification.checks.map((check) => markdownText(check.name) + " (" + check.status + ")").join(", ")
      );
    } else lines.push("- Verification: not supplied");
    lines.push("");
  }
  lines.push("### Blockers", "");
  if (report.blockers.length) report.blockers.forEach((item) => lines.push("- " + markdownText(item)));
  else lines.push("- None reported");
  lines.push("", "### Next actions", "");
  if (report.nextActions.length) report.nextActions.forEach((item) => lines.push("- " + markdownText(item)));
  else lines.push("- No outstanding actions from supplied task evidence");
  lines.push("", "> Completion is counted only when passing checks are tied to a pinned commit.", "",
    "_Scope: " + markdownText(report.scope) + "_", "");
  return lines.join("\n");
}
