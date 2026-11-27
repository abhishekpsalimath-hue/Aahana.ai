const MAX_STEPS = 8;
const ALLOWED_TOOLS = new Set([
  "list_approved_source_files",
  "submit_change_plan",
  "read_approved_source_file",
  "propose_source_changes",
]);

export function createSelfBuildExecutionJournal() {
  return { steps: [] };
}

export function startSelfBuildExecutionStep(journal, tool) {
  if (!journal || !Array.isArray(journal.steps) || !ALLOWED_TOOLS.has(tool)) {
    throw new TypeError("Invalid execution journal or tool.");
  }
  if (journal.steps.length >= MAX_STEPS) throw new RangeError("Execution journal step limit reached.");
  const step = Object.freeze({ step: journal.steps.length + 1, tool, status: "started", outcomeCode: "IN_PROGRESS", retryAllowed: false });
  journal.steps.push(step);
  return step.step;
}

export function finishSelfBuildExecutionStep(journal, stepNumber, { ok, outcomeCode = "TOOL_EXECUTION_FAILED", retryAllowed = false } = {}) {
  if (!journal || !Array.isArray(journal.steps) || !Number.isSafeInteger(stepNumber) ||
      typeof ok !== "boolean" || typeof outcomeCode !== "string" || !/^[A-Z0-9_]{1,64}$/.test(outcomeCode) ||
      typeof retryAllowed !== "boolean") {
    throw new TypeError("Invalid execution step result.");
  }
  const index = journal.steps.findIndex((step) => step.step === stepNumber);
  if (index < 0 || journal.steps[index].status !== "started") throw new Error("Execution step is missing or already finalized.");
  journal.steps[index] = Object.freeze({
    ...journal.steps[index],
    status: ok ? "succeeded" : "failed",
    outcomeCode: ok ? "TOOL_SUCCEEDED" : outcomeCode,
    retryAllowed: ok ? false : retryAllowed,
  });
}

export function summarizeSelfBuildExecutionJournal(journal) {
  if (!journal || !Array.isArray(journal.steps)) throw new TypeError("Invalid execution journal.");
  return Object.freeze(journal.steps.slice(0, MAX_STEPS).map((step) => Object.freeze({ ...step })));
}
