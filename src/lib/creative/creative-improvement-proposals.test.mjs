import test from "node:test";
import assert from "node:assert/strict";
import { buildCreativeImprovementProposals } from "./creative-improvement-proposals.mjs";

test("prioritizes weak human-reviewed creative dimensions",()=>{
 const result=buildCreativeImprovementProposals({imageReviews:[
  {scores:{subjectFidelity:2,attributeFidelity:4,compositionFidelity:3,constraintFidelity:5,visualCoherence:4}},
 ]});
 assert.equal(result.proposals[0].id,"image-subjectFidelity");
 assert.equal(result.proposals[0].priority,"high");
 assert.equal(result.proposals[0].evidence.averageScore,2);
});
test("turns regression and insufficient model evidence into explicit follow-ups",()=>{
 const result=buildCreativeImprovementProposals({
  videoRegression:{status:"regression-detected",regressions:["case-level-regressions"],caseRegressions:[{}],categoryRegressions:[]},
  videoModelComparison:{recommendation:{status:"insufficient-evidence"},models:[{},{}]},
 });
 assert.deepEqual(result.proposals.map((item)=>item.id),["video-regression-follow-up","model-evidence-expansion"]);
});
test("returns an empty safe report and rejects malformed evidence",()=>{
 assert.equal(buildCreativeImprovementProposals().proposalCount,0);
 assert.throws(()=>buildCreativeImprovementProposals({imageReviews:[{scores:{subjectFidelity:9}}]}),/invalid dimension score/);
});
