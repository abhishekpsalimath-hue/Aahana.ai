/**
 * Compare two runs of the same video metadata benchmark. This deliberately
 * refuses cross-benchmark and changed-catalogue comparisons.
 */
function finite(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${label} must be a finite number.`);
  return value;
}
function caseMap(run, label) {
  if (!run || typeof run !== "object" || !Array.isArray(run.results) || run.results.length === 0) {
    throw new TypeError(`${label} must contain benchmark results.`);
  }
  const map = new Map();
  for (const item of run.results) {
    if (!item || typeof item.caseId !== "string" || !item.caseId || map.has(item.caseId)) {
      throw new TypeError(`${label} contains an invalid or duplicate case result.`);
    }
    finite(item.structuralScore, `${label} structuralScore`);
    if (typeof item.passed !== "boolean") throw new TypeError(`${label} case pass status must be boolean.`);
    if (typeof item.category !== "string" || !item.category.trim()) throw new TypeError(`${label} case category is required.`);
    map.set(item.caseId, item);
  }
  return map;
}
const rounded = (value) => Number(value.toFixed(3));
function summarizeCategories(map) {
  const grouped = new Map();
  for (const item of map.values()) {
    if (!grouped.has(item.category)) grouped.set(item.category, []);
    grouped.get(item.category).push(item);
  }
  return new Map([...grouped].map(([category, items]) => [category, {
    cases:items.length,
    passRate:rounded(items.filter((item) => item.passed).length / items.length),
    averageStructuralScore:rounded(items.reduce((sum, item) => sum + item.structuralScore, 0) / items.length),
  }]));
}

export function compareVideoBenchmarkRuns({baseline, candidate, minimumScoreDrop = 0.01} = {}) {
  if (!baseline || !candidate || baseline.benchmark !== candidate.benchmark) {
    throw new Error("Regression comparison requires matching video benchmark identifiers.");
  }
  if (baseline.catalogueCases !== candidate.catalogueCases) {
    throw new Error("Regression comparison requires the same benchmark catalogue size.");
  }
  finite(minimumScoreDrop, "minimumScoreDrop");
  if (minimumScoreDrop < 0) throw new RangeError("minimumScoreDrop cannot be negative.");
  const before = caseMap(baseline, "baseline");
  const after = caseMap(candidate, "candidate");
  const beforeIds = [...before.keys()].sort();
  const afterIds = [...after.keys()].sort();
  if (beforeIds.length !== afterIds.length || beforeIds.some((id, index) => id !== afterIds[index])) {
    throw new Error("Regression comparison requires an identical evaluated case set.");
  }
  const caseRegressions = [];
  const caseImprovements = [];
  for (const id of beforeIds) {
    const oldResult = before.get(id);
    const newResult = after.get(id);
    if (oldResult.category !== newResult.category) throw new Error(`Benchmark category changed for case ${id}; category comparison is unsafe.`);
    const delta = rounded(newResult.structuralScore - oldResult.structuralScore);
    const item = {caseId:id,category:oldResult.category,baselineScore:oldResult.structuralScore,candidateScore:newResult.structuralScore,scoreDelta:delta,baselinePassed:oldResult.passed,candidatePassed:newResult.passed};
    if ((oldResult.passed && !newResult.passed) || delta <= -minimumScoreDrop) caseRegressions.push(item);
    else if ((!oldResult.passed && newResult.passed) || delta >= minimumScoreDrop) caseImprovements.push(item);
  }
  const baselinePassRate = finite(baseline.passRate, "baseline.passRate");
  const candidatePassRate = finite(candidate.passRate, "candidate.passRate");
  const baselineScore = finite(baseline.averageStructuralScore, "baseline.averageStructuralScore");
  const candidateScore = finite(candidate.averageStructuralScore, "candidate.averageStructuralScore");
  const baselineCoverage = finite(baseline.coverageRate, "baseline.coverageRate");
  const candidateCoverage = finite(candidate.coverageRate, "candidate.coverageRate");
  const severityNames = [...new Set([...Object.keys(baseline.issueCounts ?? {}), ...Object.keys(candidate.issueCounts ?? {})])].sort();
  const issueCountDeltas = Object.fromEntries(severityNames.map((name) => {
    const oldCount = baseline.issueCounts?.[name] ?? 0;
    const newCount = candidate.issueCounts?.[name] ?? 0;
    if (!Number.isInteger(oldCount) || oldCount < 0 || !Number.isInteger(newCount) || newCount < 0) throw new TypeError("Issue counts must be non-negative integers.");
    return [name, newCount - oldCount];
  }));
  const baselineCategories = summarizeCategories(before);
  const candidateCategories = summarizeCategories(after);
  const categoryRegressions = [];
  const categoryImprovements = [];
  for (const category of [...baselineCategories.keys()].sort()) {
    const oldSummary = baselineCategories.get(category);
    const newSummary = candidateCategories.get(category);
    if (!newSummary || oldSummary.cases !== newSummary.cases) throw new Error("Category case coverage changed; category comparison is unsafe.");
    const delta = rounded(newSummary.averageStructuralScore - oldSummary.averageStructuralScore);
    const item = {category,cases:oldSummary.cases,baselinePassRate:oldSummary.passRate,candidatePassRate:newSummary.passRate,passRateDelta:rounded(newSummary.passRate-oldSummary.passRate),baselineAverageScore:oldSummary.averageStructuralScore,candidateAverageScore:newSummary.averageStructuralScore,scoreDelta:delta};
    if (newSummary.passRate < oldSummary.passRate || delta <= -minimumScoreDrop) categoryRegressions.push(item);
    else if (newSummary.passRate > oldSummary.passRate || delta >= minimumScoreDrop) categoryImprovements.push(item);
  }
  const regressions = [];
  if (candidatePassRate < baselinePassRate) regressions.push("pass-rate-decreased");
  if (candidateScore < baselineScore - minimumScoreDrop) regressions.push("average-structural-score-decreased");
  if (candidateCoverage < baselineCoverage) regressions.push("coverage-decreased");
  if (caseRegressions.length) regressions.push("case-level-regressions");
  if (categoryRegressions.length) regressions.push("category-level-regressions");
  if (Object.values(issueCountDeltas).some((delta) => delta > 0)) regressions.push("issue-severity-count-increased");
  return Object.freeze({
    benchmark:baseline.benchmark,
    comparisonScope:"Video continuity metadata benchmark only; not comparable with image benchmarks or rendered-media quality.",
    baseline:{passRate:baselinePassRate,averageStructuralScore:baselineScore,coverageRate:baselineCoverage},
    candidate:{passRate:candidatePassRate,averageStructuralScore:candidateScore,coverageRate:candidateCoverage},
    deltas:{passRate:rounded(candidatePassRate-baselinePassRate),averageStructuralScore:rounded(candidateScore-baselineScore),coverageRate:rounded(candidateCoverage-baselineCoverage),issueCounts:Object.freeze(issueCountDeltas)},
    categoryRegressions:Object.freeze(categoryRegressions),
    categoryImprovements:Object.freeze(categoryImprovements),
    regressions:Object.freeze(regressions),
    caseRegressions:Object.freeze(caseRegressions),
    caseImprovements:Object.freeze(caseImprovements),
    status:regressions.length ? "regression-detected" : "no-regression-detected",
  });
}
