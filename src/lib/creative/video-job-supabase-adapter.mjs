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

const VALID_STATES = new Set(["queued", "running", "succeeded", "failed", "cancelled"]);

function validateIdentity(ownerId, idempotencyKey, job, revision) {
  if (typeof ownerId !== "string" || !ownerId ||
      typeof idempotencyKey !== "string" || !idempotencyKey ||
      !job || typeof job !== "object" ||
      job.ownerId !== ownerId || job.idempotencyKey !== idempotencyKey ||
      typeof job.id !== "string" || !job.id ||
      !Number.isSafeInteger(revision) || revision < 1) {
    throw new TypeError("Video job identity or revision does not match the persistence request.");
  }
}

function validateSnapshot(job, revision) {
  if (!job || typeof job !== "object" || !Number.isSafeInteger(revision) || revision < 1 ||
      typeof job.id !== "string" || !job.id ||
      typeof job.ownerId !== "string" || !job.ownerId ||
      typeof job.idempotencyKey !== "string" || !job.idempotencyKey ||
      !VALID_STATES.has(job.state) ||
      !Number.isSafeInteger(job.progress) || job.progress < 0 || job.progress > 100 ||
      !Number.isSafeInteger(job.attempt) || !Number.isSafeInteger(job.maxAttempts) ||
      job.maxAttempts < 1 || job.maxAttempts > 3 || job.attempt < 0 || job.attempt > job.maxAttempts ||
      typeof job.retryable !== "boolean" ||
      !(job.errorCode === null || (typeof job.errorCode === "string" && /^[a-z0-9][a-z0-9._-]{0,63}$/.test(job.errorCode)))) {
    throw new TypeError("The video job snapshot contains invalid fields.");
  }
  for (const field of ["createdAt", "updatedAt"]) {
    if (!Number.isFinite(job[field]) || job[field] < 0) throw new TypeError("Invalid video job timestamp.");
  }
  for (const field of ["startedAt", "completedAt"]) {
    if (!(job[field] === null || (Number.isFinite(job[field]) && job[field] >= 0))) {
      throw new TypeError("Invalid video job timestamp.");
    }
  }
  if (job.updatedAt < job.createdAt ||
      (job.startedAt !== null && job.startedAt < job.createdAt) ||
      (job.completedAt !== null && job.completedAt < (job.startedAt ?? job.createdAt))) {
    throw new TypeError("Video job timestamps are not chronologically coherent.");
  }
  if (job.retryable && (job.state !== "failed" || job.attempt >= job.maxAttempts)) {
    throw new TypeError("Only a retryable failed job with attempts remaining may be marked retryable.");
  }
  if (job.state === "queued" && (job.startedAt !== null || job.completedAt !== null || job.progress !== 0 || job.errorCode !== null || job.retryable)) {
    throw new TypeError("Queued video jobs must have a canonical unstarted snapshot.");
  }
  if (job.state === "running" && (job.startedAt === null || job.completedAt !== null || job.errorCode !== null || job.retryable || job.progress > 99)) {
    throw new TypeError("Running video jobs must have a canonical active snapshot.");
  }
  if (job.state === "succeeded" && (job.startedAt === null || job.completedAt === null || job.progress !== 100 || job.errorCode !== null || job.retryable)) {
    throw new TypeError("Succeeded video jobs must have a canonical terminal snapshot.");
  }
  if (job.state === "failed" && (job.startedAt === null || job.completedAt === null || job.errorCode === null)) {
    throw new TypeError("Failed video jobs must have a canonical terminal snapshot.");
  }
  if (job.state === "cancelled" && (job.completedAt === null || job.errorCode !== null || job.retryable)) {
    throw new TypeError("Cancelled video jobs must have a canonical terminal snapshot.");
  }
}

function toRow(ownerId, idempotencyKey, job, revision) {
  validateIdentity(ownerId, idempotencyKey, job, revision);
  validateSnapshot(job, revision);
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
  if (typeof row.job_id !== "string" || typeof row.owner_id !== "string" ||
      typeof row.idempotency_key !== "string" || !Number.isSafeInteger(row.revision)) {
    throw new TypeError("The video job database returned an invalid identity.");
  }
  const job = {
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
  };
  validateSnapshot(job, row.revision);
  return Object.freeze({ revision: row.revision, job: Object.freeze(job) });
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
      validateIdentity(ownerId, idempotencyKey, job, revision);
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
      if (typeof ownerId !== "string" || !ownerId || typeof jobId !== "string" || !jobId ||
          !Number.isSafeInteger(expectedRevision) || expectedRevision < 1 ||
          !nextRecord || !Number.isSafeInteger(nextRecord.revision) ||
          nextRecord.revision !== expectedRevision + 1 ||
          nextRecord.job?.id !== jobId || nextRecord.job?.ownerId !== ownerId ||
          typeof nextRecord.job?.idempotencyKey !== "string" || !nextRecord.job.idempotencyKey) {
        throw new TypeError("Video job compare-and-swap identity or revision is invalid.");
      }
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
