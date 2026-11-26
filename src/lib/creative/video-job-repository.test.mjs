import test from "node:test";
import assert from "node:assert/strict";
import { createVideoJob, startVideoJob, updateVideoJobProgress } from "./video-job-lifecycle.mjs";
import { createVideoJobRepository } from "./video-job-repository.mjs";

function makeAdapter() {
  const rows = new Map();
  const unique = new Map();
  return {
    async insertIfAbsent({ ownerId, idempotencyKey, job, revision }) {
      const key = ownerId + "::" + idempotencyKey;
      if (unique.has(key)) return { inserted: false, record: rows.get(unique.get(key)) };
      const row = { revision, job };
      rows.set(job.id, row);
      unique.set(key, job.id);
      return { inserted: true, record: row };
    },
    async getOwned(ownerId, jobId) {
      const row = rows.get(jobId);
      return row?.job.ownerId === ownerId ? row : null;
    },
    async compareAndSwap({ ownerId, jobId, expectedRevision, nextRecord }) {
      const current = rows.get(jobId);
      if (!current || current.job.ownerId !== ownerId || current.revision !== expectedRevision) {
        return { updated: false };
      }
      rows.set(jobId, nextRecord);
      return { updated: true, record: nextRecord };
    },
  };
}

const makeJob = (overrides = {}) => createVideoJob({
  id: "video-job-1", ownerId: "owner-1", idempotencyKey: "request-1", createdAt: 100,
  ...overrides,
});

test("requires an explicit persistence adapter and all atomic operations", () => {
  assert.throws(() => createVideoJobRepository(), /insertIfAbsent/);
  assert.throws(() => createVideoJobRepository({ insertIfAbsent() {}, getOwned() {} }), /compareAndSwap/);
});

test("creates once per owner and idempotency key and returns the existing job on replay", async () => {
  const repository = createVideoJobRepository(makeAdapter());
  const first = await repository.createOrGet(makeJob());
  const replay = await repository.createOrGet(makeJob({ id: "video-job-replay" }));
  assert.equal(first.inserted, true);
  assert.equal(first.record.revision, 1);
  assert.equal(replay.inserted, false);
  assert.equal(replay.record.job.id, "video-job-1");
  assert.equal(Object.isFrozen(replay.record.job), true);
});

test("scopes reads and writes to the owning user", async () => {
  const repository = createVideoJobRepository(makeAdapter());
  await repository.createOrGet(makeJob());
  assert.equal(await repository.getOwned("another-owner", "video-job-1"), null);
  const result = await repository.transition({
    ownerId: "another-owner", jobId: "video-job-1", expectedRevision: 1,
    apply: (job) => startVideoJob(job, 110),
  });
  assert.equal(result.status, "not_found");
});

test("persists lifecycle snapshots with monotonic revisions and detects stale writers", async () => {
  const repository = createVideoJobRepository(makeAdapter());
  await repository.createOrGet(makeJob());
  const started = await repository.transition({
    ownerId: "owner-1", jobId: "video-job-1", expectedRevision: 1,
    apply: (job) => startVideoJob(job, 110),
  });
  assert.equal(started.status, "updated");
  assert.equal(started.record.revision, 2);
  assert.equal(started.record.job.state, "running");
  const stale = await repository.transition({
    ownerId: "owner-1", jobId: "video-job-1", expectedRevision: 1,
    apply: (job) => updateVideoJobProgress(job, 20, 120),
  });
  assert.equal(stale.status, "conflict");
  assert.equal(stale.record.revision, 2);
  assert.equal((await repository.getOwned("owner-1", "video-job-1")).job.progress, 0);
});

test("rejects transitions that change immutable identity fields", async () => {
  const repository = createVideoJobRepository(makeAdapter());
  await repository.createOrGet(makeJob());
  await assert.rejects(repository.transition({
    ownerId: "owner-1", jobId: "video-job-1", expectedRevision: 1,
    apply: (job) => ({ ...job, ownerId: "victim" }),
  }), /cannot change job identity/);
});

test("detects concurrent compare-and-swap races rather than overwriting newer progress", async () => {
  const adapter = makeAdapter();
  const repository = createVideoJobRepository(adapter);
  await repository.createOrGet(makeJob());
  const first = await repository.transition({
    ownerId: "owner-1", jobId: "video-job-1", expectedRevision: 1,
    apply: (job) => startVideoJob(job, 110),
  });
  assert.equal(first.status, "updated");
  const contenders = await Promise.all([
    repository.transition({
      ownerId: "owner-1", jobId: "video-job-1", expectedRevision: 2,
      apply: (job) => updateVideoJobProgress(job, 25, 120),
    }),
    repository.transition({
      ownerId: "owner-1", jobId: "video-job-1", expectedRevision: 2,
      apply: (job) => updateVideoJobProgress(job, 50, 120),
    }),
  ]);
  assert.equal(contenders.filter((item) => item.status === "updated").length, 1);
  assert.equal(contenders.filter((item) => item.status === "conflict").length, 1);
});


test("rejects malformed or already-started snapshots at the create boundary", async () => {
  const repository = createVideoJobRepository(makeAdapter());
  const invalid = [
    { ...makeJob(), state: "running" },
    { ...makeJob(), progress: 10 },
    { ...makeJob(), attempt: 1 },
    { ...makeJob(), retryable: true },
    { ...makeJob(), unexpected: "field" },
  ];
  for (const job of invalid) {
    await assert.rejects(repository.createOrGet(job), /fresh, validated queued video job/);
  }
});
