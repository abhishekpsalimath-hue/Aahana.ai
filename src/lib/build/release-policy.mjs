const CHANGE_RISK = Object.freeze({
  ui: "low",
  visual: "low",
  documentation: "low",
  "test-only": "low",
  bugfix: "medium",
  feature: "medium",
  architecture: "high",
  reasoning: "high",
  auth: "critical",
  security: "critical",
  database: "critical",
  billing: "critical",
  secrets: "critical",
  "production-config": "critical",
});

const AUTOMATION_ELIGIBLE = new Set(["ui", "visual", "documentation", "test-only"]);
const REQUIRED_CHECKS = Object.freeze(["build", "tests", "security", "regression"]);

function validateAutomationPolicy(classes) {
  if (!Array.isArray(classes)) {
    throw new Error("Automatic release policy must be a server-controlled list.");
  }

  const unique = new Set(classes);
  if (unique.size !== classes.length || classes.some((item) => !AUTOMATION_ELIGIBLE.has(item))) {
    throw new Error("Automatic release is restricted to explicitly eligible low-risk change classes.");
  }
  return unique;
}

/**
 * Pure release gate. Call only from trusted server code.
 * ownerApproved must come from a verified owner approval record, never model output
 * or a client-supplied boolean. This function never performs a deployment.
 */
export function evaluateReleaseEligibility({
  changeClass,
  checks,
  automaticReleaseClasses = [],
  ownerApproved = false,
} = {}) {
  if (typeof changeClass !== "string" || !Object.hasOwn(CHANGE_RISK, changeClass)) {
    return Object.freeze({
      decision: "approval-required",
      risk: "unknown",
      reason: "Unclassified changes cannot be released automatically.",
    });
  }

  if (typeof ownerApproved !== "boolean") {
    throw new Error("Owner approval must be resolved by trusted server code.");
  }

  const automaticClasses = validateAutomationPolicy(automaticReleaseClasses);
  const failedChecks = REQUIRED_CHECKS.filter((check) => checks?.[check] !== true);
  if (failedChecks.length > 0) {
    return Object.freeze({
      decision: "blocked",
      risk: CHANGE_RISK[changeClass],
      failedChecks: Object.freeze(failedChecks),
      reason: "Every required verification check must pass before release.",
    });
  }

  const risk = CHANGE_RISK[changeClass];
  if (risk === "critical" || risk === "high") {
    return Object.freeze({
      decision: ownerApproved ? "ready-for-owner-release" : "approval-required",
      risk,
      reason: "High-impact changes require explicit owner approval and a separate release action.",
    });
  }

  if (automaticClasses.has(changeClass)) {
    return Object.freeze({
      decision: "eligible-for-automatic-release",
      risk,
      reason: "This low-risk change class is enabled by the server-controlled owner policy.",
    });
  }

  return Object.freeze({
    decision: ownerApproved ? "ready-for-owner-release" : "approval-required",
    risk,
    reason: "This change class is not enabled for automatic release.",
  });
}

export const RELEASE_REQUIRED_CHECKS = REQUIRED_CHECKS;
