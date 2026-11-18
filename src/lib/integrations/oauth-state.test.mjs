import test from "node:test";
import assert from "node:assert/strict";
import { createOAuthState, verifyOAuthState } from "./oauth-state.mjs";

const secret = "test-only-secret-with-more-than-thirty-two-characters";
const userId = "123e4567-e89b-42d3-a456-426614174000";

test("OAuth state is signed and bound to its provider and signed-in user", () => {
  const state = createOAuthState({
    providerId: "google-drive",
    userId,
    redirectPath: "/operations/integrations",
    issuedAt: 1_800_000_000,
  }, secret);

  assert.deepEqual(verifyOAuthState(state, {
    secret,
    expectedProviderId: "google-drive",
    expectedUserId: userId,
    now: 1_800_000_100,
  }), {
    providerId: "google-drive",
    userId,
    redirectPath: "/operations/integrations",
    issuedAt: 1_800_000_000,
  });
  assert.equal(verifyOAuthState(state, {
    secret,
    expectedProviderId: "gmail",
    expectedUserId: userId,
    now: 1_800_000_100,
  }), null);
  assert.equal(verifyOAuthState(state, {
    secret,
    expectedProviderId: "google-drive",
    expectedUserId: "123e4567-e89b-42d3-a456-426614174001",
    now: 1_800_000_100,
  }), null);
});

test("OAuth state rejects tampering, expiry and timestamps too far in the future", () => {
  const state = createOAuthState({
    providerId: "github",
    userId,
    issuedAt: 1_800_000_000,
  }, secret);
  const [payload, signature] = state.split(".");
  const tampered = Buffer.from(payload, "base64url").toString("utf8").replace("github", "slack");
  const tamperedState = Buffer.from(tampered).toString("base64url") + "." + signature;

  assert.equal(verifyOAuthState(tamperedState, {
    secret, expectedProviderId: "github", expectedUserId: userId, now: 1_800_000_100,
  }), null);
  assert.equal(verifyOAuthState(state, {
    secret, expectedProviderId: "github", expectedUserId: userId, now: 1_800_000_601,
  }), null);
  assert.equal(verifyOAuthState(state, {
    secret, expectedProviderId: "github", expectedUserId: userId, now: 1_799_999_000,
  }), null);
});

test("OAuth state creation rejects open redirects and weak secrets", () => {
  assert.throws(() => createOAuthState({
    providerId: "github", userId, redirectPath: "//evil.example/path",
  }, secret), /internal path/);
  assert.throws(() => createOAuthState({
    providerId: "github", userId,
  }, "weak"), /32 characters/);
});
