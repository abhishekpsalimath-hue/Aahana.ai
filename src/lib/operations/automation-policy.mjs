const TRIGGERS = new Set(["manual", "schedule", "event"]);
const INTERNAL_ACTIONS = new Set([
  "prepare_brief",
  "summarise_status",
  "draft_follow_up",
  "research_watch",
  "prepare_content",
]);

export const PRIVATE_AUTOMATION_TEMPLATES = Object.freeze([
  Object.freeze({ id: "founder-daily-brief", name: "Founder daily brief", trigger: "schedule", cadence: "daily", action: "prepare_brief", description: "Prepare a private morning summary of approved priorities, blockers and decisions." }),
  Object.freeze({ id: "venture-status-watch", name: "Venture status watch", trigger: "schedule", cadence: "daily", action: "summarise_status", description: "Summarise progress and blockers across founder-selected venture projects." }),
  Object.freeze({ id: "research-watchlist", name: "Research watchlist", trigger: "schedule", cadence: "weekly", action: "research_watch", description: "Prepare a sourced digest for founder-selected competitors, markets or topics." }),
  Object.freeze({ id: "follow-up-drafts", name: "Follow-up assistant", trigger: "event", cadence: "on_task_change", action: "draft_follow_up", description: "Draft reminders and follow-ups when a founder-approved task changes status." }),
  Object.freeze({ id: "content-preparation", name: "Content preparation", trigger: "manual", cadence: "on_demand", action: "prepare_content", description: "Prepare content drafts and a review queue without publishing." }),
]);

export function validatePrivateAutomationProposal(input = {}) {
  const templateId = typeof input.templateId === "string" ? input.templateId.trim() : "";
  const template = PRIVATE_AUTOMATION_TEMPLATES.find((item) => item.id === templateId);
  if (!template) throw new TypeError("Unknown private automation template.");

  const name = typeof input.name === "string" && input.name.trim()
    ? input.name.trim().slice(0, 120)
    : template.name;

  const enabled = input.enabled === true;
  return Object.freeze({
    id: template.id,
    name,
    trigger: template.trigger,
    cadence: template.cadence,
    action: template.action,
    description: template.description,
    status: "proposed",
    enabled: false,
    approvalRequired: true,
    executionMode: "internal_draft_only",
    externalActionsAllowed: false,
    requestedEnabled: enabled,
  });
}

export function isPrivateAutomationExecutionAllowed(automation, approval = {}) {
  return Boolean(
    automation &&
    automation.status === "approved" &&
    automation.approvalRequired === true &&
    automation.enabled === true &&
    automation.executionMode === "internal_draft_only" &&
    automation.externalActionsAllowed === false &&
    TRIGGERS.has(automation.trigger) &&
    INTERNAL_ACTIONS.has(automation.action) &&
    approval.founderApproved === true &&
    approval.automationId === automation.id
  );
}
