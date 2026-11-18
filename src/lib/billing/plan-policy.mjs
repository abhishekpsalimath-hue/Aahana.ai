export const AAHANA_PLANS = Object.freeze({
  basic: Object.freeze({
    id: "basic",
    name: "Basic",
    pricePaise: 0,
    gstRatePercent: 0,
    publicLaunchEnabled: true,
    purchaseEnabled: true,
    entitlements: Object.freeze({
      textQuestions: "unlimited",
      textConversations: "unlimited",
      freeVideosPerDay: 3,
      maxFreeVideoSeconds: 8,
      paidVideoPackSeconds: 45,
      paidVideoPriceRupees: 9,
      paidVideoRequiresExplicitConfirmation: true,
    }),
  }),
  pro: Object.freeze({
    id: "pro",
    name: "Pro",
    pricePaise: 65900,
    gstRatePercent: 18,
    publicLaunchEnabled: false,
    purchaseEnabled: false,
    entitlements: Object.freeze({
      textQuestions: "unlimited",
      textConversations: "unlimited",
      freeVideosPerDay: 3,
      maxFreeVideoSeconds: 45,
    }),
  }),
});

export function getPlanDefinition(planId = "basic") {
  return AAHANA_PLANS[planId] || AAHANA_PLANS.basic;
}

export function getProPriceBreakdown() {
  const plan = AAHANA_PLANS.pro;
  const gstPaise = Math.round(plan.pricePaise * plan.gstRatePercent / 100);
  return Object.freeze({
    basePaise: plan.pricePaise,
    gstPaise,
    totalPaise: plan.pricePaise + gstPaise,
    currency: "INR",
  });
}

export function getVideoAllowance(planId = "basic", videosUsedToday = 0) {
  const plan = getPlanDefinition(planId);
  const used = Number.isInteger(videosUsedToday) && videosUsedToday > 0 ? videosUsedToday : 0;
  const remainingFree = Math.max(0, plan.entitlements.freeVideosPerDay - used);
  const isProUnavailable = plan.id === "pro" && !plan.purchaseEnabled;
  return Object.freeze({
    planId: plan.id,
    freeVideosPerDay: plan.entitlements.freeVideosPerDay,
    remainingFree,
    maxFreeVideoSeconds: plan.entitlements.maxFreeVideoSeconds,
    canGenerateFreeVideo: !isProUnavailable && remainingFree > 0,
    requiresExplicitPurchase: plan.id === "basic" && remainingFree === 0,
    paidVideoPackSeconds: plan.entitlements.paidVideoPackSeconds ?? null,
    paidVideoPriceRupees: plan.entitlements.paidVideoPriceRupees ?? null,
    proAvailable: plan.id !== "pro" || plan.purchaseEnabled,
  });
}
