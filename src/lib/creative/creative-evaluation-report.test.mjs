import test from "node:test";
import assert from "node:assert/strict";
import { buildCreativeEvaluationReport } from "./creative-evaluation-report.mjs";

const imageReview={sampleId:"image-sample-01",caseId:"IMG-001",category:"people",model:"image-fixture",reviewer:"reviewer-a",reviewedAt:"2026-11-25T12:00:00Z",scores:{subjectFidelity:5,attributeFidelity:4,compositionFidelity:4,constraintFidelity:5,visualCoherence:4}};
const videoReview=(shotNumber,sampleId)=>({seriesId:"video-series-01",sampleId,model:"video-fixture",reviewer:"reviewer-a",shotNumber,reviewedAt:"2026-11-25T12:00:00Z",scores:{identityContinuity:5,motionContinuity:4,cameraContinuity:4,transitionCoherence:5,temporalProgression:4}});
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