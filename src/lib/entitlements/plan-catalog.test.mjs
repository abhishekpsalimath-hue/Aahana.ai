import test from "node:test";
import assert from "node:assert/strict";
import {
  canUsePaidPlanFeature,
  getPlanCatalog,
  getPlanEntitlements,
} from "./plan-catalog.mjs";

test("keeps Basic available with unlimited ordinary text and agreed free video allowance", () => {
  const basic = getPlanEntitlements("basic");
  assert.equal(basic.active, true);
  assert.equal(basic.textQuestions, "unlimited");
  assert.equal(basic.freeVideosPerDay, 3);
  assert.equal(basic.maxFreeVideoSeconds, 8);
  assert.equal(basic.extraVideoPricePaise, 900);
});

test("keeps Pro inactive until a future explicit activation path exists", () => {
  const pro = getPlanEntitlements("pro", { subscriptionActive: true });
  assert.equal(pro.availability, "approval_required");
  assert.equal(pro.active, false);
  assert.equal(pro.monthlyPricePaise, 65900);
  assert.equal(pro.gstPercent, 18);
  assert.equal(pro.monthlyTotalPaise, 77762);
  assert.equal(canUsePaidPlanFeature("pro", "automations", { subscriptionActive: true }), false);
});

test("does not invent Plus benefits or enable Plus entitlements", () => {
  const plus = getPlanEntitlements("plus", { subscriptionActive: true });
  assert.equal(plus.availability, "definition_required");
  assert.equal(plus.active, false);
  assert.equal(canUsePaidPlanFeature("plus", "imageGeneration", { subscriptionActive: true }), false);
});

test("returns isolated catalog snapshots and rejects unknown plans", () => {
  const catalog = getPlanCatalog();
  catalog.basic.textQuestions = "limited";
  assert.equal(getPlanEntitlements("basic").textQuestions, "unlimited");
  assert.equal(getPlanEntitlements("unknown"), null);
});
