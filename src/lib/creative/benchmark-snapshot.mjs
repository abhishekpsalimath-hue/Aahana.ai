import { createHash } from "node:crypto";

function canonicalize(value, seen = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Snapshot values cannot contain non-finite numbers.");
    return value;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new TypeError("Snapshot values cannot contain circular references.");
    seen.add(value);
    const result = value.map((item) => canonicalize(item, seen));
    seen.delete(value);
    return result;
  }
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError("Snapshot values must contain only plain JSON-compatible objects.");
  }
  if (seen.has(value)) throw new TypeError("Snapshot values cannot contain circular references.");
  seen.add(value);
  const result = Object.fromEntries(Object.keys(value).sort().map((key) => {
    if (value[key] === undefined) throw new TypeError("Snapshot values cannot contain undefined fields.");
    return [key, canonicalize(value[key], seen)];
  }));
  seen.delete(value);
  return result;
}
function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

/** Create a deterministic, content-addressed snapshot of an offline evaluation. */
export function createBenchmarkSnapshot({benchmark, benchmarkVersion, commitSha, modelLabel, runAt, results} = {}) {
  for (const [name, value] of Object.entries({benchmark, benchmarkVersion, commitSha, modelLabel, runAt})) {
    if (typeof value !== "string" || !value.trim()) throw new TypeError(`${name} is required.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(runAt) || Number.isNaN(Date.parse(runAt))) {
    throw new TypeError("runAt must be a UTC ISO-8601 timestamp.");
  }
  if (!Array.isArray(results) || results.length === 0) throw new TypeError("results must be a non-empty array.");
  const payload = canonicalize({schemaVersion:1,benchmark,benchmarkVersion,commitSha,modelLabel,runAt,results});
  const canonicalJson = JSON.stringify(payload);
  const digest = createHash("sha256").update(canonicalJson, "utf8").digest("hex");
  return deepFreeze({...payload, digest});
}
