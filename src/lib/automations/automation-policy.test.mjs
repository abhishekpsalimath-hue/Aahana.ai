import test from "node:test";
import assert from "node:assert/strict";
import {
  canExecuteAutomation,
  createAutomationRunKey,
  validateAutomationDefinition,
} from "./automation-policy.mjs";

const base = {
  name: "Daily founder brief",
  trigger: { type: "schedule", frequency: "daily", hour: 9, minute: 30, timeZone: "Asia/Kolkata" },
  actions: [{ type: "assistant_summary" }, { type: "notify_owner" }],
};

test("validates a daily schedule and always creates it disabled", () => {
  const result = validateAutomationDefinition(base);
  assert.equal(result.ok, true);
  assert.equal(result.value.enabled, false);
  assert.equal(result.value.requiresApproval, false);
  assert.equal(result.value.trigger.timeZone, "Asia/Kolkata");
});

test("rejects malformed time zones, clock values, and duplicate weekdays", () => {
  assert.equal(validateAutomationDefinition({ ...base, trigger: { ...base.trigger, timeZone: "Mars/Olympus" } }).ok, false);
  assert.equal(validateAutomationDefinition({ ...base, trigger: { ...base.trigger, hour: 24 } }).ok, false);
  assert.equal(validateAutomationDefinition({ ...base, trigger: { ...base.trigger, frequency: "weekly", daysOfWeek: [1, 1] } }).ok, false);
});

test("rejects unknown event triggers, unknown actions, and excessive action counts", () => {
  assert.equal(validateAutomationDefinition({ ...base, trigger: { type: "event", event: "account.deleted" } }).ok, false);
  assert.equal(validateAutomationDefinition({ ...base, actions: [{ type: "run_arbitrary_code" }] }).ok, false);
  assert.equal(validateAutomationDefinition({ ...base, actions: Array(6).fill({ type: "assistant_summary" }) }).ok, false);
});

test("requires owner identity and explicit owner approval for high-impact actions", () => {
  const automation = { enabled: true, actions: [{ type: "send_message" }] };
  assert.deepEqual(canExecuteAutomation({ automation, ownerId: "owner-1", actorId: "other" }), { allowed: false, reason: "owner_mismatch" });
  assert.deepEqual(canExecuteAutomation({ automation, ownerId: "owner-1", actorId: "owner-1" }), { allowed: false, reason: "approval_required" });
  assert.deepEqual(canExecuteAutomation({
    automation, ownerId: "owner-1", actorId: "owner-1",
    approval: { approved: true, ownerId: "owner-1" },
  }), { allowed: true, reason: "allowed" });
});

test("blocks disabled automations and approvals issued for another owner", () => {
  const automation = { enabled: false, actions: [{ type: "delete_data" }] };
  assert.equal(canExecuteAutomation({ automation, ownerId: "a", actorId: "a", approval: { approved: true, ownerId: "a" } }).reason, "disabled");
  assert.equal(canExecuteAutomation({
    automation: { ...automation, enabled: true }, ownerId: "a", actorId: "a",
    approval: { approved: true, ownerId: "b" },
  }).reason, "approval_owner_mismatch");
});

test("creates stable UTC idempotency keys and rejects invalid inputs", () => {
  assert.equal(createAutomationRunKey("daily-brief", "2026-11-25T03:30:00+05:30"), "automation:daily-brief:run:2026-11-24T22:00:00.000Z");
  assert.equal(createAutomationRunKey("", "2026-11-25T00:00:00Z"), null);
  assert.equal(createAutomationRunKey("a", "not-a-date"), null);
});
