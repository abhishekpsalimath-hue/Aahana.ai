import test from "node:test";
import assert from "node:assert/strict";
import { resolveAssistantBenchmarkBudget, canStartAssistantBenchmarkCase } from "./assistant-benchmark-budget.mjs";

test("preflights answer-plus-judge requests and defaults to a ten-case ceiling", () => {
  assert.deepEqual(resolveAssistantBenchmarkBudget({ caseCount: 100 }), {
    casesToRun: 10, estimatedProviderRequests: 20, maxCases: 10,
    maxProviderRequests: 20, retriesPerRequest: 0,
  });
});

test("never schedules a partial case when the provider-request budget is odd or too small", () => {
  assert.equal(resolveAssistantBenchmarkBudget({ caseCount: 100, maxCases: 100, maxProviderRequests: 19 }).casesToRun, 9);
  assert.equal(resolveAssistantBenchmarkBudget({ caseCount: 100, maxCases: 100, maxProviderRequests: 1 }).casesToRun, 0);
});

test("caps requested work to both configured ceilings and the available case count", () => {
  assert.equal(resolveAssistantBenchmarkBudget({ caseCount: 7, maxCases: 50, maxProviderRequests: 200 }).casesToRun, 7);
  assert.equal(resolveAssistantBenchmarkBudget({ caseCount: 100, maxCases: 3, maxProviderRequests: 200 }).estimatedProviderRequests, 6);
});

test("rejects invalid budgets and stops before exceeding the hard provider-request cap", () => {
  assert.throws(() => resolveAssistantBenchmarkBudget({ caseCount: 100, maxCases: 101 }), /budget/);
  assert.throws(() => resolveAssistantBenchmarkBudget({ caseCount: 100, maxProviderRequests: 201 }), /budget/);
  assert.equal(canStartAssistantBenchmarkCase(18, 20), true);
  assert.equal(canStartAssistantBenchmarkCase(19, 20), false);
  assert.equal(canStartAssistantBenchmarkCase(20, 20), false);
});
