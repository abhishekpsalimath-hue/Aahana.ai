const ROLES = new Set(["ceo", "cto", "coo", "cmo"]);

export function isClaimedTaskValidForInternalAnalysis(task) {
  return Boolean(
    task &&
    task.status === "in_progress" &&
    task.approval_required === true &&
    typeof task.approved_at === "string" &&
    ROLES.has(task.assigned_role) &&
    Number.isInteger(task.execution_attempts) &&
    task.execution_attempts >= 1 &&
    task.execution_attempts <= 3
  );
}
