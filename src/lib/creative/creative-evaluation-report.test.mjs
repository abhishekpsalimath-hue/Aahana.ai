import test from "node:test";
import assert from "node:assert/strict";
import { buildCreativeEvaluationReport } from "./creative-evaluation-report.mjs";
import { VIDEO_BENCHMARK_CASES } from "./video-benchmark-cases.mjs";
import { runVideoContinuityBenchmark } from "./video-benchmark-runner.mjs";

const imageReview={sampleId:"image-sample-01",caseId:"IMG-001",category:"people",model:"image-fixture",reviewer:"reviewer-a",reviewedAt:"2026-11-25T12:00:00Z",scores:{subjectFidelity:5,attributeFidelity:4,compositionFidelity:4,constraintFidelity:5,visualCoherence:4}};
const videoReview=(shotNumber,sampleId)=>({seriesId:"video-series-01",sampleId,model:"video-fixture",reviewer:"reviewer-a",shotNumber,reviewedAt:"2026-11-25T12:00:00Z",scores:{identityContinuity:5,motionContinuity:4,cameraContinuity:4,transitionCoherence:5,temporalProgression:4}});
function planFor(item, mutate = false) {
 const shots=Array.from({length:item.shotCount},(_,index)=>{
  const shot={shotNumber:index+1,subjectId:mutate && item.id==="VID-001" ? "wrong-subject" : item.expected.subjectId,actionProgress:index};
  for (const field of ["wardrobeId","propIds","cameraSide","screenDirection"]) if (item.expected[field]!==undefined) shot[field]=item.expected[field];
  if (item.required.includes("transition")) shot.transition="motivated match cut";
  return shot;
 });
 return {caseId:item.id,shots};
}
const completePlans=()=>VIDEO_BENCHMARK_CASES.map((item)=>planFor(item));
test("builds separate image and video evidence sections without conflating rubrics",()=>{
 const report=buildCreativeEvaluationReport({imageReviews:[imageReview],videoReviews:[videoReview(1,"clip-sample-01"),videoReview(2,"clip-sample-02")]});
 assert.equal(report.image.humanOutputReviews[0].distinctSamples,1);
 assert.equal(report.video.humanShotReviews[0].reviewedShots,2);
 assert.match(report.comparisonPolicy,/Do not compare image and video averages/);
 assert.match(report.evidenceScope,/no provider calls or media inspection/);
});
test("supports an empty report and rejects non-array input",()=>{
 const report=buildCreativeEvaluationReport();
 assert.deepEqual(report.image.humanOutputReviews,[]);
 assert.deepEqual(report.video.humanShotReviews,[]);
 assert.throws(()=>buildCreativeEvaluationReport({videoReviews:{}}),/must be arrays/);
});
test("embeds a coverage-aware video structural benchmark separately from human ratings",()=>{
 const item=VIDEO_BENCHMARK_CASES[0];
 const report=buildCreativeEvaluationReport({videoContinuityPlans:[planFor(item)]});
 assert.equal(report.video.structuralPreflight.evaluatedCases,1);
 assert.equal(report.video.structuralPreflight.catalogueCases,12);
 assert.equal(report.video.structuralPreflight.coverageRate,Number((1/12).toFixed(3)));
 assert.equal(report.video.humanShotReviews.length,0);
 assert.match(report.video.structuralPreflight.scope,/Metadata-only/);
});
test("attaches baseline regression analysis and a reproducible provenance snapshot",()=>{
 const baseline=runVideoContinuityBenchmark(completePlans());
 const candidatePlans=completePlans().map((item)=>item.caseId==="VID-001" ? planFor(VIDEO_BENCHMARK_CASES[0],true) : item);
 const report=buildCreativeEvaluationReport({
  videoContinuityPlans:candidatePlans,
  videoBaselineRun:baseline,
  snapshotProvenance:{benchmarkVersion:"v1",commitSha:"test-commit",modelLabel:"offline-preflight",runAt:"2026-11-25T12:00:00Z"},
 });
 assert.equal(report.video.regression.status,"regression-detected");
 assert.ok(report.video.regression.caseRegressions.some((item)=>item.caseId==="VID-001"));
 assert.equal(report.video.reproducibleSnapshot.schemaVersion,1);
 assert.equal(report.video.reproducibleSnapshot.commitSha,"test-commit");
 assert.match(report.video.reproducibleSnapshot.digest,/^[a-f0-9]{64}$/);
});
test("requires candidate plans when baseline or snapshot provenance is supplied",()=>{
 assert.throws(()=>buildCreativeEvaluationReport({videoBaselineRun:{}}),/requires candidate/);
 assert.throws(()=>buildCreativeEvaluationReport({snapshotProvenance:{}}),/requires candidate/);
});
