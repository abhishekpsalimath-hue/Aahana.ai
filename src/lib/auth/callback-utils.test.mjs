import test from "node:test";
import assert from "node:assert/strict";
import { getSafeAuthNext, isSupportedOtpType } from "./callback-utils.mjs";

test("keeps safe local destinations after confirmation", () => {
  assert.equal(getSafeAuthNext("/"), "/");
  assert.equal(getSafeAuthNext("/settings?tab=profile"), "/settings?tab=profile");
});

test("blocks external and malformed destinations", () => {
  assert.equal(getSafeAuthNext("https://example.com"), "/");
  assert.equal(getSafeAuthNext("//example.com"), "/");
  assert.equal(getSafeAuthNext("settings"), "/");
  assert.equal(getSafeAuthNext("/\\evil.example"), "/");
});

test("accepts supported Supabase email verification types only", () => {
  assert.equal(isSupportedOtpType("signup"), true);
  assert.equal(isSupportedOtpType("recovery"), true);
  assert.equal(isSupportedOtpType("unknown"), false);
  assert.equal(isSupportedOtpType(undefined), false);
});
