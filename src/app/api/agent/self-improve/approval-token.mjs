import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const APPROVAL_TOKEN_TTL_MS = 10 * 60 * 1000;

function approvalSigningKey(env = process.env) {
  const privateKey = String(env.AAHANA_GITHUB_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!privateKey.trim()) throw new Error("The self-build approval signing key is unavailable.");
  return createHmac("sha256", privateKey).update("aahana-self-build-plan-approval:v1").digest();
}

export function createApprovalToken(
  { userId, task, pathHint, plan, baseSha },
  env = process.env,
  now = Date.now(),
) {
  const payload = Buffer.from(JSON.stringify({
    userId, task, pathHint, plan, baseSha, expiresAt: now + APPROVAL_TOKEN_TTL_MS,
  })).toString("base64url");
  const signature = createHmac("sha256", approvalSigningKey(env)).update(payload).digest("base64url");
  return payload + "." + signature;
}

export function verifyApprovalToken(token, expected, env = process.env, now = Date.now()) {
  if (typeof token !== "string" || token.length > 12000) return false;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;

  try {
    const supplied = Buffer.from(parts[1], "base64url");
    const expectedSignature = createHmac("sha256", approvalSigningKey(env)).update(parts[0]).digest();
    if (supplied.length !== expectedSignature.length || !timingSafeEqual(supplied, expectedSignature)) return false;

    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    return Number.isFinite(payload?.expiresAt) && payload.expiresAt > now &&
      payload.userId === expected.userId &&
      payload.task === expected.task &&
      payload.pathHint === expected.pathHint &&
      payload.baseSha === expected.baseSha &&
      JSON.stringify(payload.plan) === JSON.stringify(expected.plan);
  } catch {
    return false;
  }
}



function validationFingerprint(files) {
  if (!Array.isArray(files) || files.length < 1 || files.length > 3) throw new Error("Validation requires one to three files.");
  const normalized = files.map((file) => {
    if (typeof file?.path !== "string" || typeof file?.content !== "string") throw new Error("Invalid validated file.");
    return { path: file.path, digest: createHash("sha256").update(file.content, "utf8").digest("hex") };
  }).sort((a, b) => a.path.localeCompare(b.path));
  if (new Set(normalized.map((file) => file.path)).size !== normalized.length) throw new Error("Duplicate validated file paths.");
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export function createValidationToken({ userId, baseSha, files }, env = process.env, now = Date.now()) {
  if (typeof userId !== "string" || !userId || !/^[a-f0-9]{40}$/i.test(String(baseSha || ""))) throw new Error("Invalid validation attestation scope.");
  const payload = Buffer.from(JSON.stringify({ userId, baseSha, fingerprint: validationFingerprint(files), expiresAt: now + APPROVAL_TOKEN_TTL_MS })).toString("base64url");
  const signature = createHmac("sha256", approvalSigningKey(env)).update("validation:v1:" + payload).digest("base64url");
  return payload + "." + signature;
}

export function verifyValidationToken(token, { userId, baseSha, files }, env = process.env, now = Date.now()) {
  if (typeof token !== "string" || token.length > 12000) return false;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  try {
    const supplied = Buffer.from(parts[1], "base64url");
    const expected = createHmac("sha256", approvalSigningKey(env)).update("validation:v1:" + parts[0]).digest();
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false;
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    return Number.isFinite(payload?.expiresAt) && payload.expiresAt > now && payload.userId === userId && payload.baseSha === baseSha && payload.fingerprint === validationFingerprint(files);
  } catch { return false; }
}