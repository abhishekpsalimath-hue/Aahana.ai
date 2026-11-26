import test from "node:test";
import assert from "node:assert/strict";
import { createCreativeBuildTaskProposals, validateCreativeBuildTargetPath, verifyCreativeBuildTaskProposal } from "./creative-build-task-proposals.mjs";

const report = {
  proposalCount: 2,
  proposals: [
    { id: "image-subjectFidelity", source: "human-review", priority: "high", title: "Improve image subject fidelity", action: "Review samples and refine constraints.", evidence: { averageScore: 2.1, reviewCount: 4 } },
    { id: "video-regression-follow-up", source: "benchmark-regression", priority: "high", title: "Investigate video regression", action: "Inspect regressed cases and rerun the benchmark.", evidence: { regressions: 2, caseCount: 3 } },
  ],
};

test("creates stable, traceable, owner-gated draft tasks from evidence-backed proposals", () => {
  const options = { improvementReport: report, targetPathsByProposal: {
    "image-subjectFidelity": ["src/lib/creative/creative-director.mjs"],
    "video-regression-follow-up": ["src/lib/creative/benchmark-regression.mjs", "src/lib/creative/benchmark-regression.test.mjs"],
  } };
  const first = createCreativeBuildTaskProposals(options);
  const second = createCreativeBuildTaskProposals(options);
  assert.deepEqual(first, second);
  assert.equal(first.taskCount, 2);
  assert.match(first.tasks[0].taskId, /^creative-task-[a-f0-9]{20}$/);
  assert.equal(first.tasks[0].status, "awaiting-owner-review");
  assert.equal(first.tasks[0].approval.status, "pending");
  assert.equal(first.tasks[0].execution.writesAllowed, false);
  assert.equal(first.tasks[0].execution.automaticAcceptance, false);
  assert.equal(first.tasks[0].execution.mergeAllowed, false);
  assert.equal(first.tasks[0].execution.deploymentAllowed, false);
  assert.deepEqual(first.tasks[0].sourceEvidence.evidence, { averageScore: 2.1, reviewCount: 4 });
});

test("permits only creative and build-internals source files", () => {
  assert.equal(validateCreativeBuildTargetPath("src/lib/creative/review.mjs"), "src/lib/creative/review.mjs");
  assert.equal(validateCreativeBuildTargetPath("src/lib/build/task.test.mjs"), "src/lib/build/task.test.mjs");
  for (const path of [
    "src/app/auth/page.jsx",
    "src/app/student-mode/page.jsx",
    "src/lib/supabase/server.js",
    "supabase/migrations/next.sql",
    ".github/workflows/deploy.yml",
    "package.json",
    "src/lib/creative/../../app/page.jsx",
    "src/lib/creative/.env.local",
    "src/lib/creative/evil／..／auth/page.jsx",
    "src/lib/creative/evil∕..∕auth/page.jsx",
    "src/lib/creative/hidden\\u202ejs.mjs",
    "src/lib/creative/hidden\\u2066js.mjs",
  ]) assert.throws(() => validateCreativeBuildTargetPath(path));
});

test("rejects malformed, duplicate, excessive and unapproved task assignments", () => {
  assert.throws(() => createCreativeBuildTaskProposals({ improvementReport: { proposalCount: 1, proposals: [] } }), /valid creative improvement report/);
  assert.throws(() => createCreativeBuildTaskProposals({ improvementReport: { proposalCount: 51, proposals: Array.from({ length: 51 }, (_, i) => ({ ...report.proposals[0], id: "proposal-" + i })) } }), /limit/);
  assert.throws(() => createCreativeBuildTaskProposals({ improvementReport: report, targetPathsByProposal: { "image-subjectFidelity": ["src/app/student-mode/page.jsx"] } }), /outside the approved/);
  const duplicate = { proposalCount: 2, proposals: [report.proposals[0], report.proposals[0]] };
  assert.throws(() => createCreativeBuildTaskProposals({ improvementReport: duplicate }), /unique/);
  assert.throws(() => createCreativeBuildTaskProposals({ improvementReport: report, targetPathsByProposal: { "image-subjectFidelity": ["src/lib/creative/a.mjs", "src/lib/creative/a.mjs"] } }), /unique/);
});


test("verifies immutable task identity and rejects client-tampered evidence, paths or permissions", () => {
  const [task] = createCreativeBuildTaskProposals({
    improvementReport: { proposalCount: 1, proposals: [report.proposals[0]] },
    targetPathsByProposal: { "image-subjectFidelity": ["src/lib/creative/creative-director.mjs"] },
  }).tasks;
  assert.equal(verifyCreativeBuildTaskProposal(task), true);
  assert.equal(verifyCreativeBuildTaskProposal({ ...task, title: "Changed title" }), false);
  assert.equal(verifyCreativeBuildTaskProposal({
    ...task, sourceEvidence: { ...task.sourceEvidence, evidence: { averageScore: 5, reviewCount: 4 } },
  }), false);
  assert.equal(verifyCreativeBuildTaskProposal({
    ...task, targetPaths: ["src/lib/creative/other.mjs"],
  }), false);
  assert.equal(verifyCreativeBuildTaskProposal({
    ...task, execution: { ...task.execution, writesAllowed: true },
  }), false);
  assert.equal(verifyCreativeBuildTaskProposal({
    ...task, approval: { required: true, status: "approved" },
  }), false);
});


test("bounds proposal text and evidence payloads before creating review tasks", () => {
  const oversizedTitle = { proposalCount: 1, proposals: [{ ...report.proposals[0], title: "x".repeat(161) }] };
  const oversizedAction = { proposalCount: 1, proposals: [{ ...report.proposals[0], action: "x".repeat(1001) }] };
  const oversizedEvidence = { proposalCount: 1, proposals: [{ ...report.proposals[0], evidence: { notes: "x".repeat(8192) } }] };
  const invalidSource = { proposalCount: 1, proposals: [{ ...report.proposals[0], source: " " }] };
  assert.throws(() => createCreativeBuildTaskProposals({ improvementReport: oversizedTitle }), /malformed proposal/);
  assert.throws(() => createCreativeBuildTaskProposals({ improvementReport: oversizedAction }), /malformed proposal/);
  assert.throws(() => createCreativeBuildTaskProposals({ improvementReport: oversizedEvidence }), /8 KB task limit/);
  assert.throws(() => createCreativeBuildTaskProposals({ improvementReport: invalidSource }), /non-empty label/);
});


test("verifier enforces the exact draft-only schema and bounded JSON evidence", () => {
  const [task] = createCreativeBuildTaskProposals({
    improvementReport: { proposalCount: 1, proposals: [report.proposals[0]] },
    targetPathsByProposal: { "image-subjectFidelity": ["src/lib/creative/creative-director.mjs"] },
  }).tasks;
  assert.equal(verifyCreativeBuildTaskProposal(task), true);
  assert.equal(verifyCreativeBuildTaskProposal({
    ...task,
    execution: { ...task.execution, providerCallsAllowed: true },
  }), false);
  assert.equal(verifyCreativeBuildTaskProposal({
    ...task,
    sourceEvidence: {
      ...task.sourceEvidence,
      evidence: { notes: "x".repeat(8192) },
    },
  }), false);
  assert.equal(verifyCreativeBuildTaskProposal({
    ...task,
    title: "x".repeat(161),
  }), false);
  assert.equal(verifyCreativeBuildTaskProposal({
    ...task,
    unexpectedPermission: true,
  }), false);
});


test("canonicalizes and deep-freezes nested evidence without retaining caller-owned objects", () => {
  const evidence = { scores: { subject: 2 }, labels: ["identity", "composition"] };
  const nestedReport = {
    proposalCount: 1,
    proposals: [{ ...report.proposals[0], evidence }],
  };
  const [task] = createCreativeBuildTaskProposals({ improvementReport: nestedReport }).tasks;
  evidence.scores.subject = 5;
  evidence.labels.push("mutated");
  assert.equal(task.sourceEvidence.evidence.scores.subject, 2);
  assert.deepEqual(task.sourceEvidence.evidence.labels, ["identity", "composition"]);
  assert.equal(Object.isFrozen(task.sourceEvidence.evidence), true);
  assert.equal(Object.isFrozen(task.sourceEvidence.evidence.scores), true);
  assert.equal(Object.isFrozen(task.sourceEvidence.evidence.labels), true);
  assert.equal(verifyCreativeBuildTaskProposal(task), true);
});
