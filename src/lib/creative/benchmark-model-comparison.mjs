import { verifyBenchmarkSnapshot } from "./benchmark-snapshot.mjs";

const rounded=(value)=>Number(value.toFixed(3));

/** Compare model-labelled snapshots only when the benchmark and evaluated cases match exactly. */
export function compareBenchmarkModels(snapshots=[], {minimumCasesForRecommendation=8,minimumRunsPerModel=2}={}) {
  if (!Array.isArray(snapshots) || snapshots.length<2) throw new TypeError("At least two model evaluation snapshots are required.");
  if (!Number.isInteger(minimumCasesForRecommendation) || minimumCasesForRecommendation<1 || !Number.isInteger(minimumRunsPerModel) || minimumRunsPerModel<1) throw new TypeError("Recommendation evidence thresholds must be positive integers.");
  const first=snapshots[0];
  if (!verifyBenchmarkSnapshot(first)) throw new Error("Model comparison contains an invalid snapshot digest.");
  const benchmark=first.benchmark;
  const benchmarkVersion=first.benchmarkVersion;
  const expectedIds=[...first.results.map((item)=>item?.caseId)].sort();
  if (expectedIds.some((id)=>typeof id!=="string" || !id)) throw new TypeError("Model snapshot contains invalid case IDs.");
  const expectedCategories=new Map(first.results.map((item)=>[item.caseId,item.category]));
  const models=new Map();
  const digests=new Set();
  for (const snapshot of snapshots) {
    if (!verifyBenchmarkSnapshot(snapshot)) throw new Error("Model comparison contains an invalid snapshot digest.");
    if (snapshot.benchmark!==benchmark || snapshot.benchmarkVersion!==benchmarkVersion) throw new Error("Model comparison requires the same benchmark and version.");
    if (digests.has(snapshot.digest)) throw new Error("Duplicate model evaluation snapshots are not allowed.");
    digests.add(snapshot.digest);
    if (typeof snapshot.modelLabel!=="string" || !snapshot.modelLabel.trim()) throw new TypeError("Every snapshot requires a model label.");
    const ids=snapshot.results.map((item)=>item?.caseId).sort();
    if (ids.length!==expectedIds.length || ids.some((id,index)=>id!==expectedIds[index])) throw new Error("Model comparison requires an identical evaluated case set.");
    const seen=new Set();
    const rows=snapshot.results.map((item)=>{
      if (!item || typeof item.caseId!=="string" || seen.has(item.caseId) || typeof item.category!=="string" || !item.category.trim() || typeof item.passed!=="boolean" || typeof item.structuralScore!=="number" || !Number.isFinite(item.structuralScore) || item.structuralScore<0 || item.structuralScore>100) {
        throw new TypeError("Model snapshot contains invalid benchmark result rows.");
      }
      if (expectedCategories.get(item.caseId)!==item.category) throw new Error("Model comparison requires identical case categories.");
      seen.add(item.caseId);
      return item;
    });
    const categories={};
    for (const item of rows) {
      if (!categories[item.category]) categories[item.category]=[];
      categories[item.category].push(item);
    }
    const summary={
      evaluatedCases:rows.length,
      passRate:rounded(rows.filter((item)=>item.passed).length/rows.length),
      averageStructuralScore:rounded(rows.reduce((sum,item)=>sum+item.structuralScore,0)/rows.length),
      categories:Object.fromEntries(Object.entries(categories).sort(([a],[b])=>a.localeCompare(b)).map(([category,items])=>[category,{
        cases:items.length,
        passRate:rounded(items.filter((item)=>item.passed).length/items.length),
        averageStructuralScore:rounded(items.reduce((sum,item)=>sum+item.structuralScore,0)/items.length),
      }])),
    };
    if (!models.has(snapshot.modelLabel)) models.set(snapshot.modelLabel,[]);
    models.get(snapshot.modelLabel).push({runAt:snapshot.runAt,commitSha:snapshot.commitSha,digest:snapshot.digest,summary});
  }
  const modelResults=[...models.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([modelLabel,runs])=>{
    for (let index=1;index<runs.length;index++) {
      if (Date.parse(runs[index].runAt)<=Date.parse(runs[index-1].runAt)) throw new Error("Snapshots for each model must be supplied in strictly chronological order.");
    }
    if (runs.some((run)=>!Number.isFinite(Date.parse(run.runAt)))) throw new TypeError("Every model snapshot requires a valid run timestamp.");
    const latest=runs[runs.length-1];
    const previous=runs.length>1?runs[runs.length-2]:null;
    return Object.freeze({
      modelLabel,
      evidence:Object.freeze({evaluatedCases:latest.summary.evaluatedCases,runs:runs.length,eligibleForRecommendation:latest.summary.evaluatedCases>=minimumCasesForRecommendation && runs.length>=minimumRunsPerModel}),
      runs:Object.freeze(runs.map((run)=>Object.freeze(run))),
      latest:Object.freeze(latest.summary),
      latestRunAt:latest.runAt,
      changeSincePrevious:previous?Object.freeze({
        passRate:rounded(latest.summary.passRate-previous.summary.passRate),
        averageStructuralScore:rounded(latest.summary.averageStructuralScore-previous.summary.averageStructuralScore),
      }):null,
    });
  });
  return Object.freeze({
    benchmark,benchmarkVersion,
    scope:"Offline video continuity metadata benchmark only. Model comparisons use the same benchmark version and exact evaluated case set; they do not measure rendered-media quality.",
    evaluatedCaseIds:Object.freeze(expectedIds),
    models:Object.freeze(modelResults),
    recommendation:modelResults.every((item)=>item.evidence.eligibleForRecommendation)?Object.freeze({status:"eligible-for-human-review",modelLabel:[...modelResults].sort((a,b)=>b.latest.averageStructuralScore-a.latest.averageStructuralScore || b.latest.passRate-a.latest.passRate)[0].modelLabel,reason:"Highest latest structural score, with pass rate as tie-breaker. Human review is required before any provider selection."}):Object.freeze({status:"insufficient-evidence",modelLabel:null,reason:"At least "+minimumCasesForRecommendation+" evaluated cases and "+minimumRunsPerModel+" chronological runs per model are required. Rankings remain descriptive and must not drive provider selection."}),
    comparison:Object.freeze({
      rankedByAverageStructuralScore:Object.freeze([...modelResults].sort((a,b)=>b.latest.averageStructuralScore-a.latest.averageStructuralScore).map((item)=>item.modelLabel)),
      rankedByPassRate:Object.freeze([...modelResults].sort((a,b)=>b.latest.passRate-a.latest.passRate).map((item)=>item.modelLabel)),
    }),
  });
}
