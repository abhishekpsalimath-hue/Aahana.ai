import test from "node:test";
import assert from "node:assert/strict";
import { AAHANA_PLANS, getPlanDefinition, getProPriceBreakdown, getVideoAllowance } from "./plan-policy.mjs";

test("Basic keeps ordinary text questions and conversations unlimited", () => {
  const basic = getPlanDefinition("basic");
  assert.equal(basic.entitlements.textQuestions, "unlimited");
  assert.equal(basic.entitlements.textConversations, "unlimited");
  assert.equal(basic.publicLaunchEnabled, true);
});

test("Pro pricing preserves the approved ₹659 plus 18% GST structure", () => {
  assert.deepEqual(getProPriceBreakdown(), {
    basePaise: 65900,
    gstPaise: 11862,
    totalPaise: 77762,
    currency: "INR",
  });
});

test("Basic video allowance is three videos up to eight seconds", () => {
  const allowance = getVideoAllowance("basic", 1);
  assert.equal(allowance.remainingFree, 2);
  assert.equal(allowance.maxFreeVideoSeconds, 8);
  assert.equal(allowance.canGenerateFreeVideo, true);
});

test("Basic overage requires explicit purchase and never implies auto-deduction", () => {
  const allowance = getVideoAllowance("basic", 3);
  assert.equal(allowance.requiresExplicitPurchase, true);
  assert.equal(allowance.paidVideoPriceRupees, 9);
  assert.equal(allowance.paidVideoPackSeconds, 45);
});

test("Pro remains unavailable until explicitly approved for launch", () => {
  assert.equal(AAHANA_PLANS.pro.publicLaunchEnabled, false);
  assert.equal(AAHANA_PLANS.pro.purchaseEnabled, false);
  const allowance = getVideoAllowance("pro", 0);
  assert.equal(allowance.proAvailable, false);
  assert.equal(allowance.canGenerateFreeVideo, false);
});

test("unknown plans safely fall back to Basic", () => {
  assert.equal(getPlanDefinition("unknown").id, "basic");
});
