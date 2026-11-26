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
