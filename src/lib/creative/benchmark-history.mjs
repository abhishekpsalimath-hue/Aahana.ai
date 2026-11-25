import { verifyBenchmarkSnapshot } from "./benchmark-snapshot.mjs";

const rounded=(value)=>Number(value.toFixed(3));
function summarize(snapshot) {
  const map=new Map();
  for (const result of snapshot.results) {
    if (!result || typeof result.caseId!=="string" || !result.caseId || map.has(result.caseId)) throw new TypeError("Snapshot contains invalid or duplicate case IDs.");
    if (typeof result.category!=="string" || !result.category.trim()) throw new TypeError("Snapshot case category is required.");
    if (typeof result.passed!=="boolean") throw new TypeError("Snapshot case pass status must be boolean.");
    if (typeof result.structuralScore!=="number" || !Number.isFinite(result.structuralScore)) throw new TypeError("Snapshot structural scores must be finite numbers.");
    map.set(result.caseId,result);
  }
  if (!map.size) throw new TypeError("Snapshot must contain evaluated cases.");
  const values=[...map.values()];
  const categories={};
  for (const item of values) {
    if (!categories[item.category]) categories[item.category]=[];
    categories[item.category].push(item);
  }
  return {
    caseIds:[...map.keys()].sort(),
    evaluatedCases:values.length,
    passRate:rounded(values.filter((item)=>item.passed).length/values.length),
    averageStructuralScore:rounded(values.reduce((sum,item)=>sum+item.structuralScore,0)/values.length),
    categories:Object.fromEntries(Object.entries(categories).sort(([a],[b])=>a.localeCompare(b)).map(([category,items])=>[category,{
      cases:items.length,
      passRate:rounded(items.filter((item)=>item.passed).length/items.length),
      averageStructuralScore:rounded(items.reduce((sum,item)=>sum+item.structuralScore,0)/items.length),
    }])),
  };
}

/** Summarize a verified, chronological sequence of same-version video benchmark snapshots. */
export function analyzeBenchmarkHistory(snapshots=[]) {
  if (!Array.isArray(snapshots) || snapshots.length<2) throw new TypeError("At least two benchmark snapshots are required.");
  const first=snapshots[0];
  if (!verifyBenchmarkSnapshot(first)) throw new Error("Benchmark history contains an invalid snapshot digest.");
  const benchmark=first.benchmark;
  const benchmarkVersion=first.benchmarkVersion;
  const seenDigests=new Set();
  let previousTime=-Infinity;
  const entries=[];
  for (const snapshot of snapshots) {
    if (!verifyBenchmarkSnapshot(snapshot)) throw new Error("Benchmark history contains an invalid snapshot digest.");
    if (snapshot.benchmark!==benchmark || snapshot.benchmarkVersion!==benchmarkVersion) throw new Error("Benchmark history requires the same benchmark and version.");
    const time=Date.parse(snapshot.runAt);
    if (!Number.isFinite(time) || time<=previousTime) throw new Error("Benchmark snapshots must be strictly chronological.");
    if (seenDigests.has(snapshot.digest)) throw new Error("Duplicate benchmark snapshots are not allowed.");
    seenDigests.add(snapshot.digest);
    const summary=summarize(snapshot);
    if (entries.length && (summary.caseIds.length!==entries[0].summary.caseIds.length || summary.caseIds.some((id,index)=>id!==entries[0].summary.caseIds[index]))) {
      throw new Error("Benchmark history requires an identical evaluated case set.");
    }
    entries.push({runAt:snapshot.runAt,commitSha:snapshot.commitSha,modelLabel:snapshot.modelLabel,digest:snapshot.digest,summary});
    previousTime=time;
  }
  const transitions=[];
  for (let index=1;index<entries.length;index++) {
    const before=entries[index-1];
    const after=entries[index];
    const passRateDelta=rounded(after.summary.passRate-before.summary.passRate);
    const scoreDelta=rounded(after.summary.averageStructuralScore-before.summary.averageStructuralScore);
    const categoryDeltas=Object.fromEntries(Object.keys(before.summary.categories).sort().map((category)=>{
      const oldValue=before.summary.categories[category];
      const newValue=after.summary.categories[category];
      if (!newValue || oldValue.cases!==newValue.cases) throw new Error("Category coverage changed across benchmark history.");
      return [category,{passRate:rounded(newValue.passRate-oldValue.passRate),averageStructuralScore:rounded(newValue.averageStructuralScore-oldValue.averageStructuralScore)}];
    }));
    const regressions=[];
    if (passRateDelta<0) regressions.push("pass-rate-decreased");
    if (scoreDelta<0) regressions.push("average-structural-score-decreased");
    if (Object.values(categoryDeltas).some((delta)=>delta.passRate<0 || delta.averageStructuralScore<0)) regressions.push("category-decreased");
    transitions.push(Object.freeze({fromDigest:before.digest,toDigest:after.digest,passRateDelta,averageStructuralScoreDelta:scoreDelta,categoryDeltas:Object.freeze(categoryDeltas),regressions:Object.freeze(regressions),status:regressions.length?"regression-detected":passRateDelta>0||scoreDelta>0?"improved-or-mixed":"no-decrease-detected"}));
  }
  return Object.freeze({
    benchmark,benchmarkVersion,
    scope:"Chronological video continuity metadata snapshots only; not rendered-media quality and not comparable with image benchmarks.",
    snapshots:Object.freeze(entries.map((entry)=>Object.freeze({...entry,summary:Object.freeze(entry.summary)}))),
    transitions:Object.freeze(transitions),
    overallTrend:transitions.some((item)=>item.status==="regression-detected")?"regressions-present":transitions.every((item)=>item.status==="improved-or-mixed")?"improving-or-mixed":"stable-or-mixed",
  });
}
