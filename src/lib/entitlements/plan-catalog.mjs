export const PLAN_IDS = Object.freeze(["basic", "pro", "plus"]);

const BASIC = Object.freeze({
  id: "basic",
  availability: "active",
  textQuestions: "unlimited",
  freeVideosPerDay: 3,
  maxFreeVideoSeconds: 8,
  extraVideoPricePaise: 900,
  extraVideoSeconds: 45,
  imageGeneration: true,
  fileWorkflows: true,
  automations: false,
});

const PRO = Object.freeze({
  id: "pro",
  availability: "approval_required",
  monthlyPricePaise: 65900,
  gstPercent: 18,
  monthlyTotalPaise: 77762,
  freeVideosPerDay: 3,
  maxFreeVideoSeconds: 45,
  extraVideoPricePaise: 900,
  extraVideoSeconds: 45,
  textQuestions: "unlimited",
  imageGeneration: true,
  fileWorkflows: true,
  automations: true,
});

const PLUS = Object.freeze({
  id: "plus",
  availability: "definition_required",
});

export function getPlanCatalog() {
  return {
    basic: { ...BASIC },
    pro: { ...PRO },
    plus: { ...PLUS },
  };
}

export function getPlanEntitlements(planId, { subscriptionActive = false } = {}) {
  if (planId === "basic") return { ...BASIC, active: true };
  if (planId === "pro") return { ...PRO, active: PRO.availability === "active" && subscriptionActive === true };
  if (planId === "plus") return { ...PLUS, active: false };
  return null;
}

export function canUsePaidPlanFeature(planId, feature, { subscriptionActive = false } = {}) {
  const plan = getPlanEntitlements(planId, { subscriptionActive });
  if (!plan || plan.active !== true) return false;
  return plan[feature] === true;
}
