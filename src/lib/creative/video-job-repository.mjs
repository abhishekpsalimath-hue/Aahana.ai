import { createVideoJob } from "./video-job-lifecycle.mjs";

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;

function requireId(value, label) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new TypeError(label + " must be a stable opaque identifier.");
  }
  return value;
}

function normalizeRecord(record, ownerId, jobId) {
  if (!record || typeof record !== "object" || Array.isArray(record) ||
      !Number.isSafeInteger(record.revision) || record.revision < 1 ||
      !record.job || typeof record.job !== "object" || Array.isArray(record.job)) {
    throw new TypeError("The video-job adapter returned an invalid versioned record.");
  }
  if (record.job.ownerId !== ownerId || record.job.id !== jobId) {
    throw new Error("The video-job adapter returned a record outside the requested owner scope.");
  }
  requireId(record.job.id, "Job id");
  requireId(record.job.ownerId, "Owner id");
  requireId(record.job.idempotencyKey, "Idempotency key");
  return Object.freeze({ revision: record.revision, job: Object.freeze({ ...record.job }) });
}

/**
 * Build an owner-scoped video-job repository around an atomic persistence adapter.
 *
 * Required adapter methods:
 * - insertIfAbsent({ ownerId, idempotencyKey, job, revision }): unique on ownerId + idempotencyKey.
 * - getOwned(ownerId, jobId): return one owner-scoped record or null.
 * - compareAndSwap({ ownerId, jobId, expectedRevision, nextRecord }): atomic revision check + write.
 *
 * This module deliberately supplies no database implementation or in-memory production fallback.
 * A database adapter must enforce both the idempotency uniqueness and compare-and-swap atomically.
 */
export function createVideoJobRepository(adapter) {
  for (const method of ["insertIfAbsent", "getOwned", "compareAndSwap"]) {
    if (typeof adapter?.[method] !== "function") {
      throw new TypeError("Video-job persistence adapter must implement " + method + "().");
    }
  }

  return Object.freeze({
    async createOrGet(job) {
      if (!job || typeof job !== "object" || Array.isArray(job)) {
        throw new TypeError("A validated video job is required.");
      }
      const ownerId = requireId(job.ownerId, "Owner id");
      const jobId = requireId(job.id, "Job id");
      const idempotencyKey = requireId(job.idempotencyKey, "Idempotency key");
      const canonical = createVideoJob({
        id: jobId, ownerId, idempotencyKey,
        createdAt: job.createdAt, maxAttempts: job.maxAttempts,
      });
      const fields = Object.keys(canonical);
      if (Object.keys(job).length !== fields.length ||
          fields.some((field) => job[field] !== canonical[field])) {
        throw new TypeError("Only a fresh, validated queued video job can be created.");
      }
      const result = await adapter.insertIfAbsent({
        ownerId, idempotencyKey, job: Object.freeze({ ...job }), revision: 1,
      });
      if (!result || typeof result.inserted !== "boolean") {
        throw new TypeError("The video-job adapter returned an invalid insert result.");
      }
      const record = normalizeRecord(result.record, ownerId, result.record?.job?.id);
      if (record.job.id !== jobId && result.inserted) {
        throw new Error("The video-job adapter inserted a different job identity.");
      }
      if (record.job.idempotencyKey !== idempotencyKey) {
        throw new Error("The video-job adapter returned a different idempotency key.");
      }
      return Object.freeze({ inserted: result.inserted, record });
    },

    async getOwned(ownerIdInput, jobIdInput) {
      const ownerId = requireId(ownerIdInput, "Owner id");
      const jobId = requireId(jobIdInput, "Job id");
      const record = await adapter.getOwned(ownerId, jobId);
      return record === null ? null : normalizeRecord(record, ownerId, jobId);
    },

    async transition({ ownerId: ownerInput, jobId: jobInput, expectedRevision, apply } = {}) {
      const ownerId = requireId(ownerInput, "Owner id");
      const jobId = requireId(jobInput, "Job id");
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
        throw new RangeError("Expected revision must be a positive safe integer.");
      }
      if (typeof apply !== "function") throw new TypeError("A job transition function is required.");
      const currentRaw = await adapter.getOwned(ownerId, jobId);
      if (currentRaw === null) return Object.freeze({ status: "not_found", record: null });
      const current = normalizeRecord(currentRaw, ownerId, jobId);
      if (current.revision !== expectedRevision) {
        return Object.freeze({ status: "conflict", record: current });
      }
      const nextJob = apply(current.job);
      if (!nextJob || typeof nextJob !== "object" || Array.isArray(nextJob) ||
          nextJob.id !== current.job.id || nextJob.ownerId !== current.job.ownerId ||
          nextJob.idempotencyKey !== current.job.idempotencyKey) {
        throw new Error("A transition cannot change job identity, owner or idempotency key.");
      }
      const nextRecord = Object.freeze({
        revision: current.revision + 1,
        job: Object.freeze({ ...nextJob }),
      });
      const result = await adapter.compareAndSwap({
        ownerId, jobId, expectedRevision, nextRecord,
      });
      if (!result || typeof result.updated !== "boolean") {
        throw new TypeError("The video-job adapter returned an invalid compare-and-swap result.");
      }
      if (!result.updated) {
        const latest = await adapter.getOwned(ownerId, jobId);
        return Object.freeze({
          status: "conflict",
          record: latest === null ? null : normalizeRecord(latest, ownerId, jobId),
        });
      }
      const persisted = normalizeRecord(result.record ?? nextRecord, ownerId, jobId);
      if (persisted.revision !== nextRecord.revision ||
          persisted.job.idempotencyKey !== current.job.idempotencyKey) {
        throw new Error("The video-job adapter did not persist the expected revision and identity.");
      }
      return Object.freeze({ status: "updated", record: persisted });
    },
  });
}
