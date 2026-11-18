import test from "node:test";
import assert from "node:assert/strict";
import { isFounderUser } from "./founder-access-policy.mjs";

test("only the exact configured founder user ID is allowed", () => {
  assert.equal(isFounderUser("founder-123", "founder-123"), true);
  assert.equal(isFounderUser("another-user", "founder-123"), false);
  assert.equal(isFounderUser("founder-123", ""), false);
  assert.equal(isFounderUser("", "founder-123"), false);
  assert.equal(isFounderUser(null, "founder-123"), false);
  assert.equal(isFounderUser("founder-123", null), false);
});
