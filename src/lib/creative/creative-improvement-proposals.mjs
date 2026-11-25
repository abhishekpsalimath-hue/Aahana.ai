const round=(value)=>Number(value.toFixed(2));

/** Convert supplied evaluation evidence into reviewable improvement proposals. No provider or production actions are performed. */
export function buildCreativeImprovementProposals({imageReviews=[],videoReviews=[],videoRegression=null,videoSnapshotHistory=null,videoModelComparison=null}={}) {
  if (!Array.isArray(imageReviews) || !Array.isArray(videoReviews)) throw new TypeError("Review evidence must be arrays.");
  const proposals=[];
  const summarizeDimensions=(reviews,dimensions,kind)=>{
    if (!reviews.length) return;
    const sums=Object.fromEntries(dimensions.map((key)=>[key,{sum:0,count:0}]));
    for (const review of reviews) {
      if (!review?.scores || typeof review.scores!=="object") throw new TypeError("Review evidence contains a malformed score record.");
      for (const key of dimensions) {
        const value=review.scores[key];
        if (!Number.isInteger(value) || value<1 || value>5) throw new TypeError("Review evidence contains an invalid dimension score.");
        sums[key].sum+=value;sums[key].count++;
      }
    }
    const ranked=Object.entries(sums).map(([dimension,item])=>({dimension,average:round(item.sum/item.count)})).sort((a,b)=>a.average-b.average || a.dimension.localeCompare(b.dimension));
    for (const item of ranked.filter((entry)=>entry.average<3.5)) proposals.push({
      id:kind+"-"+item.dimension,
      source:"human-review",
      priority:item.average<2.5?"high":"medium",
      title:"Improve "+item.dimension,
      evidence:{averageScore:item.average,reviewCount:reviews.length},
      action:"Review representative samples and refine the corresponding creative constraints; rerun the same evaluation rubric.",
    });
  };
  summarizeDimensions(imageReviews,["subjectFidelity","attributeFidelity","compositionFidelity","constraintFidelity","visualCoherence"],"image");
  summarizeDimensions(videoReviews,["identityContinuity","motionContinuity","cameraContinuity","transitionCoherence","temporalProgression"],"video");
  if (videoRegression?.status==="regression-detected") proposals.push({
    id:"video-regression-follow-up",source:"benchmark-regression",priority:"high",
    title:"Investigate video continuity regressions",
    evidence:{regressions:videoRegression.regressions,caseCount:videoRegression.caseRegressions?.length??0,categoryCount:videoRegression.categoryRegressions?.length??0},
    action:"Inspect the regressed cases and categories, correct the shot-plan constraints, then rerun the identical benchmark case set.",
  });
  if (videoSnapshotHistory?.overallTrend==="regressions-present") proposals.push({
    id:"video-history-regression-follow-up",source:"benchmark-history",priority:"high",
    title:"Investigate regressions across video benchmark history",
    evidence:{transitionCount:videoSnapshotHistory.transitions?.length??0},
    action:"Compare the affected chronological transitions and isolate the commit or planning change associated with each regression.",
  });
  if (videoModelComparison?.recommendation?.status==="insufficient-evidence") proposals.push({
    id:"model-evidence-expansion",source:"model-comparison",priority:"medium",
    title:"Expand model-comparison evidence",
    evidence:{models:videoModelComparison.models?.length??0,requiredCases:8,requiredRunsPerModel:2},
    action:"Collect additional comparable offline benchmark runs; keep model rankings descriptive until evidence thresholds are met.",
  });
  const order={high:0,medium:1,low:2};
  proposals.sort((a,b)=>order[a.priority]-order[b.priority] || a.id.localeCompare(b.id));
  return Object.freeze({
    scope:"Reviewable recommendations from supplied evidence only. No model selection, provider activation, generation, deployment, or production mutation.",
    proposalCount:proposals.length,
    proposals:Object.freeze(proposals.map((item)=>Object.freeze({...item,evidence:Object.freeze(item.evidence)}))),
  });
}
