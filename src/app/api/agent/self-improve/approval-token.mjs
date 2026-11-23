import { createHmac, timingSafeEqual } from "node:crypto";

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
