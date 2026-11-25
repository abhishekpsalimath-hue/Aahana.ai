import { VIDEO_BENCHMARK_CASES, getVideoBenchmarkCase } from "./video-benchmark-cases.mjs";
import { evaluateVideoContinuityPlan } from "./video-continuity-preflight.mjs";

function mean(values) {
  return values.length ? Number((values.reduce((sum,value)=>sum+value,0)/values.length).toFixed(2)) : null;
}

/**
 * Execute a complete offline batch of metadata-only video continuity checks.
 * Exactly one plan per catalogue case is required so coverage and omissions
 * cannot be hidden by a high pass rate over a small subset.
 */
export function runVideoContinuityBenchmark(plans) {
  if (!Array.isArray(plans) || plans.length===0) throw new TypeError("Provide a non-empty array of video continuity plans.");
  const seen=new Set();
  const results=plans.map((plan,index)=>{
    if (!plan || typeof plan!=="object" || Array.isArray(plan)) throw new TypeError(`Plan ${index+1} must be an object.`);
    const benchmarkCase=getVideoBenchmarkCase(plan.caseId);
    if (!benchmarkCase) throw new RangeError(`Plan ${index+1} references an unknown video benchmark case.`);
    if (seen.has(benchmarkCase.id)) throw new Error(`Duplicate video benchmark plan for case ${benchmarkCase.id}.`);
    seen.add(benchmarkCase.id);
    return evaluateVideoContinuityPlan(plan);
  });
  const missingCaseIds=VIDEO_BENCHMARK_CASES.map((item)=>item.id).filter((id)=>!seen.has(id));
  const categoryNames=[...new Set(VIDEO_BENCHMARK_CASES.map((item)=>item.category))].sort();
  const byCategory=Object.fromEntries(categoryNames.map((category)=>{
    const entries=results.filter((item)=>item.category===category);
    return [category,{
      catalogueCases:VIDEO_BENCHMARK_CASES.filter((item)=>item.category===category).length,
      evaluatedCases:entries.length,
      passedCases:entries.filter((item)=>item.passed).length,
      averageStructuralScore:mean(entries.map((item)=>item.structuralScore)),
    }];
  }));
  const issueCounts={critical:0,major:0};
  for(const result of results) for(const issue of result.issues) issueCounts[issue.severity]=(issueCounts[issue.severity]??0)+1;
  const passedCases=results.filter((item)=>item.passed).length;
  return Object.freeze({
    benchmark:"video-continuity-metadata-v1",
    scope:"Metadata-only structural preflight; no video pixels, audio, motion, or generated media are inspected.",
    catalogueCases:VIDEO_BENCHMARK_CASES.length,
    evaluatedCases:results.length,
    coverageRate:Number((results.length/VIDEO_BENCHMARK_CASES.length).toFixed(3)),
    missingCaseIds:Object.freeze(missingCaseIds),
    passedCases,
    failedCases:results.length-passedCases,
    passRate:Number((passedCases/results.length).toFixed(3)),
    averageStructuralScore:mean(results.map((item)=>item.structuralScore)),
    issueCounts:Object.freeze(issueCounts),
    byCategory:Object.freeze(byCategory),
    results:Object.freeze(results),
  });
}
