const STATES = new Set(["queued", "running", "succeeded", "failed", "cancelled"]);
const TERMINAL = new Set(["succeeded", "failed", "cancelled"]);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const MAX_ATTEMPTS = 3;

function requireId(value, label) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) throw new TypeError(label + " must be a stable opaque identifier.");
  return value;
}

function requireTime(value, label) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(label + " must be a non-negative timestamp.");
  return value;
}

function freezeJob(job) {
  return Object.freeze({ ...job });
}

/** Create a minimal job record. Persist this contract in a durable queue before relying on it across processes. */
export function createVideoJob({ id, ownerId, idempotencyKey, createdAt, maxAttempts = MAX_ATTEMPTS } = {}) {
  requireId(id, "Job id");
  requireId(ownerId, "Owner id");
  requireId(idempotencyKey, "Idempotency key");
  requireTime(createdAt, "Created time");
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > MAX_ATTEMPTS) {
    throw new RangeError("Maximum attempts must be between 1 and 3.");
  }
  return freezeJob({
    id, ownerId, idempotencyKey, state: "queued", progress: 0,
    attempt: 0, maxAttempts, retryable: false, createdAt,
    updatedAt: createdAt, startedAt: null, completedAt: null,
    errorCode: null,
  });
}

export function startVideoJob(job, now) {
  requireTime(now, "Start time");
  if (!job || job.state !== "queued") throw new Error("Only queued video jobs can start.");
  if (now < job.updatedAt) throw new RangeError("Job timestamps cannot move backwards.");
  if (job.attempt >= job.maxAttempts) throw new Error("Video job has exhausted its attempts.");
  return freezeJob({
    ...job, state: "running", attempt: job.attempt + 1,
    progress: 0, retryable: false, startedAt: now, updatedAt: now,
    completedAt: null, errorCode: null,
  });
}

export function updateVideoJobProgress(job, progress, now) {
  requireTime(now, "Progress update time");
  if (!job || job.state !== "running") throw new Error("Only running video jobs can report progress.");
  if (!Number.isFinite(progress) || progress < job.progress || progress < 0 || progress > 99) {
    throw new RangeError("Running job progress must be monotonic and between 0 and 99.");
  }
  if (now < job.updatedAt) throw new RangeError("Job timestamps cannot move backwards.");
  return freezeJob({ ...job, progress, updatedAt: now });
}

export function completeVideoJob(job, now) {
  requireTime(now, "Completion time");
  if (!job || job.state !== "running") throw new Error("Only running video jobs can complete.");
  if (now < job.updatedAt) throw new RangeError("Job timestamps cannot move backwards.");
  return freezeJob({ ...job, state: "succeeded", progress: 100, retryable: false, updatedAt: now, completedAt: now, errorCode: null });
}

export function failVideoJob(job, { now, errorCode, retryable = false } = {}) {
  requireTime(now, "Failure time");
  if (!job || job.state !== "running") throw new Error("Only running video jobs can fail.");
  if (now < job.updatedAt) throw new RangeError("Job timestamps cannot move backwards.");
  if (typeof errorCode !== "string" || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(errorCode)) {
    throw new TypeError("A bounded provider-neutral error code is required.");
  }
  const canRetry = retryable === true && job.attempt < job.maxAttempts;
  return freezeJob({ ...job, state: "failed", retryable: canRetry, updatedAt: now, completedAt: now, errorCode });
}

export function retryVideoJob(job, now) {
  requireTime(now, "Retry time");
  if (!job || job.state !== "failed" || job.retryable !== true) throw new Error("Only retryable failed jobs can be retried.");
  if (job.attempt >= job.maxAttempts) throw new Error("Video job has exhausted its attempts.");
  if (now < job.updatedAt) throw new RangeError("Job timestamps cannot move backwards.");
  return freezeJob({
    ...job, state: "queued", progress: 0, retryable: false,
    updatedAt: now, startedAt: null, completedAt: null, errorCode: null,
  });
}

export function cancelVideoJob(job, now) {
  requireTime(now, "Cancellation time");
  if (!job || TERMINAL.has(job.state)) throw new Error("A terminal video job cannot be cancelled.");
  if (now < job.updatedAt) throw new RangeError("Job timestamps cannot move backwards.");
  return freezeJob({ ...job, state: "cancelled", retryable: false, updatedAt: now, completedAt: now, errorCode: null });
}

export function isTerminalVideoJob(job) {
  return Boolean(job && STATES.has(job.state) && TERMINAL.has(job.state));
}

export const VIDEO_JOB_POLICY = Object.freeze({
  states: Object.freeze([...STATES]),
  terminalStates: Object.freeze([...TERMINAL]),
  maxAttempts: MAX_ATTEMPTS,
  maxReportedProgress: 99,
  persistence: "not implemented; caller must persist atomically before claiming durable jobs",
});
