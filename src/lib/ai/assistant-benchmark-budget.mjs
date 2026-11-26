export const MAX_ASSISTANT_BENCHMARK_CASES = 100;
export const PROVIDER_REQUESTS_PER_CASE = 2;

export function resolveAssistantBenchmarkBudget({ caseCount, maxCases = 10, maxProviderRequests = 20 }) {
  if (!Number.isSafeInteger(caseCount) || caseCount < 0 ||
      !Number.isSafeInteger(maxCases) || maxCases < 1 || maxCases > MAX_ASSISTANT_BENCHMARK_CASES ||
      !Number.isSafeInteger(maxProviderRequests) || maxProviderRequests < 0 || maxProviderRequests > MAX_ASSISTANT_BENCHMARK_CASES * PROVIDER_REQUESTS_PER_CASE) {
    throw new RangeError("Invalid assistant benchmark budget.");
  }
  const casesToRun = Math.min(caseCount, maxCases, Math.floor(maxProviderRequests / PROVIDER_REQUESTS_PER_CASE));
  return Object.freeze({
    casesToRun,
    estimatedProviderRequests: casesToRun * PROVIDER_REQUESTS_PER_CASE,
    maxCases,
    maxProviderRequests,
    retriesPerRequest: 0,
  });
}

export function canStartAssistantBenchmarkCase(providerRequestsUsed, maxProviderRequests) {
  return Number.isSafeInteger(providerRequestsUsed) && providerRequestsUsed >= 0 &&
    Number.isSafeInteger(maxProviderRequests) && maxProviderRequests >= 0 &&
    providerRequestsUsed + PROVIDER_REQUESTS_PER_CASE <= maxProviderRequests;
}
