import test from "node:test";
import assert from "node:assert/strict";
import { createCreativeBuildTaskProposals } from "./creative-build-task-proposals.mjs";
import { createCreativeTaskReviewDecision } from "./creative-task-review.mjs";

const [task] = createCreativeBuildTaskProposals({
  improvementReport: {
    proposalCount: 1,
    proposals: [{
      id: "image-subject-fidelity",
      source: "human-review",
      priority: "high",
      title: "Improve image subject fidelity",
      action: "Review low-scoring samples and refine constraints.",
      evidence: { averageScore: 2.1, reviewCount: 4 },
    }],
  },
  targetPathsByProposal: {
    "image-subject-fidelity": ["src/lib/creative/creative-director.mjs"],
  },
}).tasks;

const owner = "founder@example.com";
const reviewedAt = "2026-11-25T14:00:00.000Z";

test("owner approval records planning-only permission and never execution permission", () => {
  const result = createCreativeTaskReviewDecision({
    task, decision: "approve-for-planning", reviewerEmail: owner.toUpperCase(),
    ownerEmail: owner, reviewedAt,
  });
  assert.equal(result.status, "approved-for-planning");
  assert.equal(result.taskId, task.taskId);
  assert.equal(result.execution.mode, "planning-only");
  assert.equal(result.execution.writesAllowed, false);
  assert.equal(result.execution.codeExecutionAllowed, false);
  assert.equal(result.execution.providerCallsAllowed, false);
  assert.equal(result.execution.automaticAcceptance, false);
  assert.equal(result.execution.mergeAllowed, false);
  assert.equal(result.execution.deploymentAllowed, false);
});

test("owner rejection records a terminal rejection without enabling execution", () => {
  const result = createCreativeTaskReviewDecision({
    task, decision: "reject", reviewerEmail: owner, ownerEmail: owner, reviewedAt,
  });
  assert.equal(result.status, "rejected");
  assert.equal(result.execution.writesAllowed, false);
  assert.equal(result.execution.codeExecutionAllowed, false);
});

test("rejects non-owner, missing owner configuration and unknown decisions", () => {
  assert.throws(() => createCreativeTaskReviewDecision({
    task, decision: "approve-for-planning", reviewerEmail: "other@example.com",
    ownerEmail: owner, reviewedAt,
  }), /Only the configured Aahana owner/);
  assert.throws(() => createCreativeTaskReviewDecision({
    task, decision: "approve-for-planning", reviewerEmail: owner, ownerEmail: "", reviewedAt,
  }), /Only the configured Aahana owner/);
  assert.throws(() => createCreativeTaskReviewDecision({
    task, decision: "execute", reviewerEmail: owner, ownerEmail: owner, reviewedAt,
  }), /Choose approve-for-planning or reject/);
});

test("rejects altered, already-reviewed or out-of-scope tasks", () => {
  assert.throws(() => createCreativeTaskReviewDecision({
    task: { ...task, execution: { ...task.execution, writesAllowed: true } },
    decision: "approve-for-planning", reviewerEmail: owner, ownerEmail: owner, reviewedAt,
  }), /valid pending, draft-only/);
  assert.throws(() => createCreativeTaskReviewDecision({
    task: { ...task, status: "approved-for-planning" },
    decision: "approve-for-planning", reviewerEmail: owner, ownerEmail: owner, reviewedAt,
  }), /valid pending, draft-only/);
  assert.throws(() => createCreativeTaskReviewDecision({
    task: { ...task, targetPaths: ["src/app/student-mode/page.jsx"] },
    decision: "approve-for-planning", reviewerEmail: owner, ownerEmail: owner, reviewedAt,
  }), /outside the approved/);
});

test("requires canonical UTC review timestamps and is deterministic", () => {
  const args = { task, decision: "approve-for-planning", reviewerEmail: owner, ownerEmail: owner, reviewedAt };
  assert.deepEqual(createCreativeTaskReviewDecision(args), createCreativeTaskReviewDecision(args));
  assert.throws(() => createCreativeTaskReviewDecision({ ...args, reviewedAt: "2026-11-25" }), /ISO-8601 UTC/);
});
