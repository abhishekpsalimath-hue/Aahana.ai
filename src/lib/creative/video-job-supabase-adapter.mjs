const TABLE = "aahana_video_jobs";

function toIso(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new TypeError("Invalid video job timestamp.");
  return new Date(milliseconds).toISOString();
}

function fromIso(value) {
  const result = Date.parse(value);
  if (!Number.isFinite(result)) throw new TypeError("The database returned an invalid video job timestamp.");
  return result;
}

function toRow(ownerId, idempotencyKey, job, revision) {
  return {
    job_id: job.id,
    owner_id: ownerId,
    idempotency_key: idempotencyKey,
    revision,
    state: job.state,
    progress: job.progress,
    attempt: job.attempt,
    max_attempts: job.maxAttempts,
    retryable: job.retryable,
    error_code: job.errorCode,
    created_at: toIso(job.createdAt),
    updated_at: toIso(job.updatedAt),
    started_at: job.startedAt === null ? null : toIso(job.startedAt),
    completed_at: job.completedAt === null ? null : toIso(job.completedAt),
  };
}

function fromRow(row) {
  if (!row || typeof row !== "object") throw new TypeError("The video job database returned an empty row.");
  return Object.freeze({
    revision: row.revision,
    job: Object.freeze({
      id: row.job_id,
      ownerId: row.owner_id,
      idempotencyKey: row.idempotency_key,
      state: row.state,
      progress: row.progress,
      attempt: row.attempt,
      maxAttempts: row.max_attempts,
      retryable: row.retryable,
      createdAt: fromIso(row.created_at),
      updatedAt: fromIso(row.updated_at),
      startedAt: row.started_at === null ? null : fromIso(row.started_at),
      completedAt: row.completed_at === null ? null : fromIso(row.completed_at),
      errorCode: row.error_code,
    }),
  });
}

/**
 * Supabase adapter for createVideoJobRepository.
 * Pass an authenticated server-side Supabase client. RLS binds every operation
 * to auth.uid(); never pass a service-role client to a user-facing route.
 */
export function createSupabaseVideoJobAdapter(supabase) {
  if (!supabase || typeof supabase.from !== "function") {
    throw new TypeError("An authenticated Supabase client is required.");
  }
  return Object.freeze({
    async insertIfAbsent({ ownerId, idempotencyKey, job, revision }) {
      const row = toRow(ownerId, idempotencyKey, job, revision);
      const inserted = await supabase.from(TABLE).insert(row).select("*").maybeSingle();
      if (!inserted.error && inserted.data) {
        return { inserted: true, record: fromRow(inserted.data) };
      }
      if (inserted.error?.code !== "23505") {
        throw new Error("Could not persist the video job.");
      }
      const existing = await supabase.from(TABLE).select("*")
        .eq("owner_id", ownerId).eq("idempotency_key", idempotencyKey).maybeSingle();
      if (existing.error) throw new Error("Could not retrieve the existing video job.");
      if (!existing.data) throw new Error("The idempotent video job could not be recovered.");
      return { inserted: false, record: fromRow(existing.data) };
    },

    async getOwned(ownerId, jobId) {
      const result = await supabase.from(TABLE).select("*")
        .eq("owner_id", ownerId).eq("job_id", jobId).maybeSingle();
      if (result.error) throw new Error("Could not retrieve the video job.");
      return result.data ? fromRow(result.data) : null;
    },

    async compareAndSwap({ ownerId, jobId, expectedRevision, nextRecord }) {
      const row = toRow(ownerId, nextRecord.job.idempotencyKey, nextRecord.job, nextRecord.revision);
      const result = await supabase.from(TABLE).update(row)
        .eq("owner_id", ownerId).eq("job_id", jobId).eq("revision", expectedRevision)
        .select("*").maybeSingle();
      if (result.error) {
        if (result.error.code === "42501") throw new Error("Video job access was denied.");
        throw new Error("Could not update the video job.");
      }
      return result.data
        ? { updated: true, record: fromRow(result.data) }
        : { updated: false };
    },
  });
}
