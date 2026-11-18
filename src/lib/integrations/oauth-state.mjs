import { createHmac, timingSafeEqual } from "node:crypto";

const STATE_TTL_SECONDS = 10 * 60;
const PROVIDER_ID = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function encode(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signature(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeInternalPath(value) {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !/[\\\\\u0000-\u001f\u007f]/u.test(value);
}

export function createOAuthState({
  providerId,
  userId,
  redirectPath = "/operations",
  issuedAt = Math.floor(Date.now() / 1000),
}, secret) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("OAuth state signing secret must contain at least 32 characters.");
  }
  if (typeof providerId !== "string" || !PROVIDER_ID.test(providerId)) {
    throw new Error("Invalid OAuth provider.");
  }
  if (typeof userId !== "string" || !USER_ID.test(userId)) {
    throw new Error("Invalid OAuth user.");
  }
  if (!safeInternalPath(redirectPath)) {
    throw new Error("OAuth redirect must be an internal path.");
  }
  if (!Number.isInteger(issuedAt)) throw new Error("Invalid OAuth state timestamp.");

  const payload = encode(JSON.stringify({ providerId, userId, redirectPath, issuedAt }));
  return payload + "." + signature(payload, secret);
}

export function verifyOAuthState(state, {
  secret,
  expectedProviderId,
  expectedUserId,
  now = Math.floor(Date.now() / 1000),
} = {}) {
  if (typeof secret !== "string" || secret.length < 32 ||
      typeof state !== "string" || state.length > 4096) return null;

  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [payload, suppliedSignature] = parts;
  const expectedSignature = signature(payload, secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  let data;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!data || !PROVIDER_ID.test(data.providerId) ||
      !USER_ID.test(data.userId) ||
      !safeInternalPath(data.redirectPath) ||
      !Number.isInteger(data.issuedAt) ||
      data.issuedAt > now + 60 ||
      now - data.issuedAt > STATE_TTL_SECONDS ||
      data.providerId !== expectedProviderId ||
      data.userId !== expectedUserId) return null;

  return Object.freeze({
    providerId: data.providerId,
    userId: data.userId,
    redirectPath: data.redirectPath,
    issuedAt: data.issuedAt,
  });
}
