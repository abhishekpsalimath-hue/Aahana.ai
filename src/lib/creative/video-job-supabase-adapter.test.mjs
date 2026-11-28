import test from "node:test";
import assert from "node:assert/strict";
import { createSupabaseVideoJobAdapter } from "./video-job-supabase-adapter.mjs";

function fakeClient() {
  const rows = [];
  const client = {
    rows,
    from(table) {
      assert.equal(table, "aahana_video_jobs");
      let filters = [];
      let operation = "select";
      let payload = null;
      return {
        insert(value) { operation = "insert"; payload = value; return this; },
        update(value) { operation = "update"; payload = value; return this; },
        select() { return this; },
        eq(key, value) { filters.push([key, value]); return this; },
        async maybeSingle() {
          const matches = () => rows.find((row) => filters.every(([key, value]) => row[key] === value)) || null;
          if (operation === "insert") {
            if (rows.some((row) => row.owner_id === payload.owner_id && row.idempotency_key === payload.idempotency_key)) {
              return { data: null, error: { code: "23505" } };
            }
            rows.push({ ...payload });
            return { data: rows.at(-1), error: null };
          }
          if (operation === "update") {
            const current = matches();
            if (!current) return { data: null, error: null };
            Object.assign(current, payload);
            return { data: current, error: null };
          }
          return { data: matches(), error: null };
        },
      };
    },
  };
  return client;
}

const job = {
  id: "a0d3cda1-1e33-4e8a-94e7-a0d3cda11e33",
  ownerId: "b0d3cda1-1e33-4e8a-94e7-a0d3cda11e33",
  idempotencyKey: "request-1",
  state: "queued", progress: 0, attempt: 0, maxAttempts: 3, retryable: false,
  createdAt: 1000, updatedAt: 1000, startedAt: null, completedAt: null, errorCode: null,
};

test("maps canonical jobs to owner-scoped Supabase rows and back", async () => {
  const client = fakeClient();
  const adapter = createSupabaseVideoJobAdapter(client);
  const first = await adapter.insertIfAbsent({ ownerId: job.ownerId, idempotencyKey: job.idempotencyKey, job, revision: 1 });
  assert.equal(first.inserted, true);
  assert.deepEqual(first.record, { revision: 1, job });
  assert.equal(client.rows[0].owner_id, job.ownerId);
  assert.equal(client.rows[0].created_at, new Date(1000).toISOString());
});

test("idempotency replay returns the original row, not the new candidate", async () => {
  const adapter = createSupabaseVideoJobAdapter(fakeClient());
  await adapter.insertIfAbsent({ ownerId: job.ownerId, idempotencyKey: job.idempotencyKey, job, revision: 1 });
  const replay = await adapter.insertIfAbsent({
    ownerId: job.ownerId, idempotencyKey: job.idempotencyKey,
    job: { ...job, id: "c0d3cda1-1e33-4e8a-94e7-a0d3cda11e33" }, revision: 1,
  });
  assert.equal(replay.inserted, false);
  assert.equal(replay.record.job.id, job.id);
});

test("owner-scoped CAS updates only the expected revision", async () => {
  const client = fakeClient();
  const adapter = createSupabaseVideoJobAdapter(client);
  await adapter.insertIfAbsent({ ownerId: job.ownerId, idempotencyKey: job.idempotencyKey, job, revision: 1 });
  const next = { revision: 2, job: { ...job, state: "running", attempt: 1, startedAt: 1100, updatedAt: 1100 } };
  const updated = await adapter.compareAndSwap({ ownerId: job.ownerId, jobId: job.id, expectedRevision: 1, nextRecord: next });
  assert.equal(updated.updated, true);
  const stale = await adapter.compareAndSwap({ ownerId: job.ownerId, jobId: job.id, expectedRevision: 1, nextRecord: next });
  assert.equal(stale.updated, false);
  assert.equal((await adapter.getOwned(job.ownerId, job.id)).revision, 2);
});

test("does not silently accept malformed adapter setup or timestamps", async () => {
  assert.throws(() => createSupabaseVideoJobAdapter(null), /authenticated Supabase client/);
  const adapter = createSupabaseVideoJobAdapter(fakeClient());
  await assert.rejects(adapter.insertIfAbsent({
    ownerId: job.ownerId, idempotencyKey: job.idempotencyKey,
    job: { ...job, createdAt: -1 }, revision: 1,
  }), /timestamp/);
});


test("rejects owner and idempotency identity mismatches before persistence", async () => {
  const adapter = createSupabaseVideoJobAdapter(fakeClient());
  await assert.rejects(adapter.insertIfAbsent({
    ownerId: "another-owner", idempotencyKey: job.idempotencyKey, job, revision: 1,
  }), /identity or revision/);
  await assert.rejects(adapter.insertIfAbsent({
    ownerId: job.ownerId, idempotencyKey: "another-key", job, revision: 1,
  }), /identity or revision/);
});

test("rejects forged CAS job identity and non-sequential revisions before database update", async () => {
  const adapter = createSupabaseVideoJobAdapter(fakeClient());
  await adapter.insertIfAbsent({ ownerId: job.ownerId, idempotencyKey: job.idempotencyKey, job, revision: 1 });
  const validNext = { revision: 2, job: { ...job, state: "running", attempt: 1, startedAt: 1100, updatedAt: 1100 } };
  await assert.rejects(adapter.compareAndSwap({
    ownerId: job.ownerId, jobId: "different-job", expectedRevision: 1, nextRecord: validNext,
  }), /identity or revision/);
  await assert.rejects(adapter.compareAndSwap({
    ownerId: job.ownerId, jobId: job.id, expectedRevision: 1,
    nextRecord: { ...validNext, revision: 3 },
  }), /identity or revision/);
  await assert.rejects(adapter.compareAndSwap({
    ownerId: "different-owner", jobId: job.id, expectedRevision: 1, nextRecord: validNext,
  }), /identity or revision/);
});

test("rejects malformed persisted row fields and incoherent lifecycle timestamps", async () => {
  const client = fakeClient();
  const adapter = createSupabaseVideoJobAdapter(client);
  await adapter.insertIfAbsent({ ownerId: job.ownerId, idempotencyKey: job.idempotencyKey, job, revision: 1 });
  client.rows[0].progress = "0";
  await assert.rejects(adapter.getOwned(job.ownerId, job.id), /invalid fields/);

  const invalidRunning = {
    ...job, state: "running", attempt: 1, startedAt: 900, updatedAt: 1100,
  };
  await assert.rejects(adapter.insertIfAbsent({
    ownerId: job.ownerId, idempotencyKey: job.idempotencyKey, job: invalidRunning, revision: 1,
  }), /chronologically coherent/);
});

test("rejects retryable failed jobs once the maximum attempt count is reached", async () => {
  const adapter = createSupabaseVideoJobAdapter(fakeClient());
  const exhausted = {
    ...job, state: "failed", attempt: 3, retryable: true,
    startedAt: 1100, completedAt: 1200, updatedAt: 1200, errorCode: "provider_failed",
  };
  await assert.rejects(adapter.insertIfAbsent({
    ownerId: job.ownerId, idempotencyKey: job.idempotencyKey, job: exhausted, revision: 1,
  }), /attempts remaining/);
});


test("rejects a mismatched owner in a database row returned despite owner filters", async () => {
  const backing = fakeClient();
  await createSupabaseVideoJobAdapter(backing).insertIfAbsent({
    ownerId: job.ownerId, idempotencyKey: job.idempotencyKey, job, revision: 1,
  });
  const maliciousClient = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() {
          return { data: { ...backing.rows[0], owner_id: "another-owner" }, error: null };
        },
      };
    },
  };
  const adapter = createSupabaseVideoJobAdapter(maliciousClient);
  await assert.rejects(adapter.getOwned(job.ownerId, job.id), /mismatched identity/);
});

test("allows queued cancellation before a worker starts through a guarded CAS transition", async () => {
  const adapter = createSupabaseVideoJobAdapter(fakeClient());
  await adapter.insertIfAbsent({
    ownerId: job.ownerId, idempotencyKey: job.idempotencyKey, job, revision: 1,
  });
  const cancelled = {
    ...job, state: "cancelled", updatedAt: 1100, completedAt: 1100,
  };
  const result = await adapter.compareAndSwap({
    ownerId: job.ownerId, jobId: job.id, expectedRevision: 1,
    nextRecord: { revision: 2, job: cancelled },
  });
  assert.equal(result.updated, true);
  assert.equal(result.record.job.state, "cancelled");
  assert.equal(result.record.job.startedAt, null);
});

test("rejects timestamp strings and malformed enum or boolean values returned by storage", async () => {
  const client = fakeClient();
  const adapter = createSupabaseVideoJobAdapter(client);
  await adapter.insertIfAbsent({ ownerId: job.ownerId, idempotencyKey: job.idempotencyKey, job, revision: 1 });
  client.rows[0].state = "unknown";
  await assert.rejects(adapter.getOwned(job.ownerId, job.id), /invalid fields/);
  client.rows[0].state = "queued";
  client.rows[0].retryable = "false";
  await assert.rejects(adapter.getOwned(job.ownerId, job.id), /invalid fields/);
  client.rows[0].retryable = false;
  client.rows[0].created_at = 1000;
  await assert.rejects(adapter.getOwned(job.ownerId, job.id), /invalid video job timestamp/);
});


test("rejects lifecycle timestamps that are later than updatedAt", async () => {
  const adapter = createSupabaseVideoJobAdapter(fakeClient());
  const invalidRunning = {
    ...job, state: "running", attempt: 1, startedAt: 1200, updatedAt: 1100,
  };
  await assert.rejects(adapter.insertIfAbsent({
    ownerId: job.ownerId, idempotencyKey: job.idempotencyKey, job: invalidRunning, revision: 1,
  }), /chronologically coherent/);
});
