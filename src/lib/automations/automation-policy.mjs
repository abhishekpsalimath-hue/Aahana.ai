export const AUTOMATION_TRIGGER_TYPES = Object.freeze(["manual", "schedule", "event"]);
export const AUTOMATION_ACTION_TYPES = Object.freeze([
  "assistant_summary",
  "draft_content",
  "organize_files",
  "notify_owner",
  "send_message",
  "publish_content",
  "purchase",
  "delete_data",
  "modify_production",
]);
const HIGH_IMPACT_ACTIONS = new Set([
  "send_message",
  "publish_content",
  "purchase",
  "delete_data",
  "modify_production",
]);
const EVENT_TYPES = new Set([
  "conversation.completed",
  "file.uploaded",
  "project.updated",
  "schedule.due",
]);

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function validateAutomationDefinition(input) {
  if (!isPlainObject(input)) return { ok: false, error: "Automation must be an object." };
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 80) return { ok: false, error: "Name must be 1–80 characters." };
  const trigger = input.trigger;
  if (!isPlainObject(trigger) || !AUTOMATION_TRIGGER_TYPES.includes(trigger.type)) {
    return { ok: false, error: "Choose a supported trigger." };
  }
  if (trigger.type === "event" && !EVENT_TYPES.has(trigger.event)) {
    return { ok: false, error: "This event trigger is not supported." };
  }
  if (trigger.type === "schedule") {
    if (typeof trigger.timeZone !== "string" || !isValidTimeZone(trigger.timeZone)) {
      return { ok: false, error: "A valid IANA time zone is required." };
    }
    if (!["daily", "weekly"].includes(trigger.frequency)) {
      return { ok: false, error: "Schedule frequency must be daily or weekly." };
    }
    if (!Number.isInteger(trigger.hour) || trigger.hour < 0 || trigger.hour > 23 ||
        !Number.isInteger(trigger.minute) || trigger.minute < 0 || trigger.minute > 59) {
      return { ok: false, error: "Schedule time is invalid." };
    }
    if (trigger.frequency === "weekly" &&
        (!Array.isArray(trigger.daysOfWeek) || trigger.daysOfWeek.length < 1 ||
         trigger.daysOfWeek.some((day) => !Number.isInteger(day) || day < 0 || day > 6) ||
         new Set(trigger.daysOfWeek).size !== trigger.daysOfWeek.length)) {
      return { ok: false, error: "Weekly schedules need unique weekdays from 0 to 6." };
    }
  }
  if (!Array.isArray(input.actions) || input.actions.length < 1 || input.actions.length > 5) {
    return { ok: false, error: "Choose between 1 and 5 actions." };
  }
  if (input.actions.some((action) => !isPlainObject(action) || !AUTOMATION_ACTION_TYPES.includes(action.type))) {
    return { ok: false, error: "One or more actions are not supported." };
  }
  return {
    ok: true,
    value: {
      name,
      description: typeof input.description === "string" ? input.description.trim().slice(0, 500) : "",
      trigger: structuredClone(trigger),
      actions: input.actions.map((action) => ({ type: action.type })),
      enabled: false,
      requiresApproval: input.actions.some((action) => HIGH_IMPACT_ACTIONS.has(action.type)),
    },
  };
}

export function isValidTimeZone(timeZone) {
  if (typeof timeZone !== "string" || timeZone.length > 100) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function canExecuteAutomation({ automation, ownerId, actorId, approval }) {
  if (!automation || typeof automation !== "object") return { allowed: false, reason: "invalid_automation" };
  if (!ownerId || actorId !== ownerId) return { allowed: false, reason: "owner_mismatch" };
  if (automation.enabled !== true) return { allowed: false, reason: "disabled" };
  const actions = Array.isArray(automation.actions) ? automation.actions : [];
  if (!actions.length || actions.some((action) => !AUTOMATION_ACTION_TYPES.includes(action?.type))) {
    return { allowed: false, reason: "unsupported_action" };
  }
  const needsApproval = actions.some((action) => HIGH_IMPACT_ACTIONS.has(action.type));
  if (needsApproval && approval?.approved !== true) {
    return { allowed: false, reason: "approval_required" };
  }
  if (needsApproval && approval?.ownerId !== ownerId) {
    return { allowed: false, reason: "approval_owner_mismatch" };
  }
  return { allowed: true, reason: "allowed" };
}

export function createAutomationRunKey(automationId, scheduledFor) {
  if (typeof automationId !== "string" || !automationId.trim() ||
      typeof scheduledFor !== "string" || !Number.isFinite(Date.parse(scheduledFor))) return null;
  return `automation:${automationId.trim()}:run:${new Date(scheduledFor).toISOString()}`;
}
