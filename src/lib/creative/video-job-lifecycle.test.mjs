import test from "node:test";
import assert from "node:assert/strict";
import { createVideoJob, startVideoJob, updateVideoJobProgress, completeVideoJob, failVideoJob, retryVideoJob, cancelVideoJob, isTerminalVideoJob, VIDEO_JOB_POLICY } from "./video-job-lifecycle.mjs";

const make = () => createVideoJob({ id: "job-001", ownerId: "user-opaque-1", idempotencyKey: "request-unique-1", createdAt: 1000 });

test("creates a minimal immutable queued job with bounded retry policy", () => {
  const job = make();
  assert.equal(job.state, "queued");
  assert.equal(job.progress, 0);
  assert.equal(job.attempt, 0);
  assert.equal(job.maxAttempts, 3);
  assert.equal(isTerminalVideoJob(job), false);
  assert.equal(Object.isFrozen(job), true);
  assert.equal(VIDEO_JOB_POLICY.persistence.startsWith("not implemented"), true);
});

test("enforces a monotonic queued-running-progress-completed lifecycle", () => {
  const queued = make();
  const running = startVideoJob(queued, 1010);
  const progressing = updateVideoJobProgress(running, 42, 1020);
  const completed = completeVideoJob(progressing, 1030);
  assert.equal(running.attempt, 1);
  assert.equal(progressing.progress, 42);
  assert.equal(completed.state, "succeeded");
  assert.equal(completed.progress, 100);
  assert.equal(isTerminalVideoJob(completed), true);
  assert.equal(queued.state, "queued", "transitions must not mutate earlier snapshots");
});

test("rejects backwards progress, invalid progress and updates after completion", () => {
  const running = startVideoJob(make(), 1010);
  assert.throws(() => updateVideoJobProgress(running, 101, 1020), /between 0 and 99/);
  assert.throws(() => updateVideoJobProgress(running, -1, 1020), /between 0 and 99/);
  const advanced = updateVideoJobProgress(running, 50, 1020);
  assert.throws(() => updateVideoJobProgress(advanced, 40, 1030), /monotonic/);
  assert.throws(() => updateVideoJobProgress(advanced, 60, 1015), /backwards/);
  assert.throws(() => updateVideoJobProgress(completeVideoJob(advanced, 1030), 80, 1040), /running/);
});

test("allows only explicitly retryable failures and caps attempts", () => {
  const firstRun = startVideoJob(make(), 1010);
  const failed = failVideoJob(firstRun, { now: 1020, errorCode: "provider.timeout", retryable: true });
  assert.equal(failed.state, "failed");
  assert.equal(failed.retryable, true);
  const queuedAgain = retryVideoJob(failed, 1030);
  assert.equal(queuedAgain.state, "queued");
  const secondRun = startVideoJob(queuedAgain, 1040);
  const secondFailure = failVideoJob(secondRun, { now: 1050, errorCode: "provider.timeout", retryable: true });
  const thirdRun = startVideoJob(retryVideoJob(secondFailure, 1060), 1070);
  const exhausted = failVideoJob(thirdRun, { now: 1080, errorCode: "provider.timeout", retryable: true });
  assert.equal(exhausted.retryable, false);
  assert.throws(() => retryVideoJob(exhausted, 1090), /retryable/);
});

test("does not retry permanent errors and rejects malformed error codes", () => {
  const running = startVideoJob(make(), 1010);
  const failed = failVideoJob(running, { now: 1020, errorCode: "provider.invalid_request", retryable: false });
  assert.equal(failed.retryable, false);
  assert.throws(() => retryVideoJob(failed, 1030), /retryable/);
  assert.throws(() => failVideoJob(running, { now: 1020, errorCode: "Provider error" }), /error code/);
});

test("cancels queued or running jobs and rejects terminal transitions", () => {
  const queued = make();
  const cancelledQueued = cancelVideoJob(queued, 1010);
  assert.equal(cancelledQueued.state, "cancelled");
  assert.equal(isTerminalVideoJob(cancelledQueued), true);
  assert.throws(() => startVideoJob(cancelledQueued, 1020), /queued/);
  const running = startVideoJob(make(), 1010);
  const cancelledRunning = cancelVideoJob(running, 1020);
  assert.equal(cancelledRunning.state, "cancelled");
  assert.throws(() => completeVideoJob(cancelledRunning, 1030), /running/);
  assert.throws(() => cancelVideoJob(cancelledRunning, 1030), /terminal/);
});

test("rejects malformed identities, attempt limits and timestamps", () => {
  assert.throws(() => createVideoJob({ id: "../bad", ownerId: "user", idempotencyKey: "key", createdAt: 1 }), /identifier/);
  assert.throws(() => createVideoJob({ id: "job", ownerId: "user", idempotencyKey: "key", createdAt: -1 }), /timestamp/);
  assert.throws(() => createVideoJob({ id: "job", ownerId: "user", idempotencyKey: "key", createdAt: 1, maxAttempts: 4 }), /between 1 and 3/);
});
