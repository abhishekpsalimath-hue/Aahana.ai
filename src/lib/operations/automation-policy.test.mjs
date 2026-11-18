import test from "node:test";
import assert from "node:assert/strict";
import {
  PRIVATE_AUTOMATION_TEMPLATES,
  validatePrivateAutomationProposal,
  isPrivateAutomationExecutionAllowed,
} from "./automation-policy.mjs";

test("private founder automation catalogue covers useful personal workflows", () => {
  assert.deepEqual(PRIVATE_AUTOMATION_TEMPLATES.map((item) => item.id), [
    "founder-daily-brief",
    "venture-status-watch",
    "research-watchlist",
    "follow-up-drafts",
    "content-preparation",
  ]);
});

test("automation proposals remain disabled and approval-gated", () => {
  const proposal = validatePrivateAutomationProposal({ templateId: "founder-daily-brief", enabled: true });
  assert.equal(proposal.status, "proposed");
  assert.equal(proposal.enabled, false);
  assert.equal(proposal.requestedEnabled, true);
  assert.equal(proposal.approvalRequired, true);
  assert.equal(proposal.executionMode, "internal_draft_only");
  assert.equal(proposal.externalActionsAllowed, false);
});

test("custom names are bounded and unknown templates fail closed", () => {
  const proposal = validatePrivateAutomationProposal({ templateId: "content-preparation", name: "  My content queue  " });
  assert.equal(proposal.name, "My content queue");
  assert.equal(validatePrivateAutomationProposal({ templateId: "content-preparation", name: "x".repeat(200) }).name.length, 120);
  assert.throws(() => validatePrivateAutomationProposal({ templateId: "send-all-emails" }), /Unknown private automation/);
});

test("execution requires approved enabled draft-only automation and exact founder approval", () => {
  const proposal = validatePrivateAutomationProposal({ templateId: "research-watchlist" });
  assert.equal(isPrivateAutomationExecutionAllowed(proposal, { founderApproved: true, automationId: proposal.id }), false);
  const approved = { ...proposal, status: "approved", enabled: true };
  assert.equal(isPrivateAutomationExecutionAllowed(approved, { founderApproved: true, automationId: proposal.id }), true);
  assert.equal(isPrivateAutomationExecutionAllowed(approved, { founderApproved: true, automationId: "other" }), false);
  assert.equal(isPrivateAutomationExecutionAllowed({ ...approved, externalActionsAllowed: true }, { founderApproved: true, automationId: proposal.id }), false);
});
