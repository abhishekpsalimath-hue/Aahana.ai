import test from "node:test";
import assert from "node:assert/strict";
import { VIDEO_BENCHMARK_CASES } from "./video-benchmark-cases.mjs";
import { runVideoContinuityBenchmark } from "./video-benchmark-runner.mjs";

function validPlan(item) {
  return {
    caseId:item.id,
    shots:Array.from({length:item.shotCount},(_,index)=>{
      const shot={shotNumber:index+1,subjectId:item.expected.subjectId,actionProgress:index};
      if(item.expected.wardrobeId) shot.wardrobeId=item.expected.wardrobeId;
      if(item.expected.propIds) shot.propIds=[...item.expected.propIds];
      if(item.expected.cameraSide) shot.cameraSide=item.expected.cameraSide;
      if(item.expected.screenDirection) shot.screenDirection=item.expected.screenDirection;
      if(item.required.includes("transition")) shot.transition="motivated match cut";
      return shot;
    }),
  };
}
test("runs the entire catalogue and reports complete coverage by category",()=>{
 const report=runVideoContinuityBenchmark(VIDEO_BENCHMARK_CASES.map(validPlan));
 assert.equal(report.catalogueCases,12);
 assert.equal(report.evaluatedCases,12);
 assert.equal(report.coverageRate,1);
 assert.deepEqual(report.missingCaseIds,[]);
 assert.equal(report.passedCases,12);
 assert.equal(report.failedCases,0);
 assert.equal(report.passRate,1);
 assert.ok(Object.values(report.byCategory).every((entry)=>entry.catalogueCases===entry.evaluatedCases));
 assert.match(report.scope,/Metadata-only/);
});
test("reports partial coverage and category-specific omissions transparently",()=>{
 const report=runVideoContinuityBenchmark([validPlan(VIDEO_BENCHMARK_CASES[0]),validPlan(VIDEO_BENCHMARK_CASES[1])]);
 assert.equal(report.evaluatedCases,2);
 assert.equal(report.coverageRate,Number((2/12).toFixed(3)));
 assert.equal(report.missingCaseIds.length,10);
 assert.equal(report.byCategory["character-continuity"].evaluatedCases,1);
 assert.equal(report.byCategory["dialogue-continuity"].evaluatedCases,0);
});
test("aggregates issue severity and does not hide failed plans in pass rate",()=>{
 const plan=validPlan(VIDEO_BENCHMARK_CASES[0]);
 plan.shots[1].subjectId="different-subject";
 const report=runVideoContinuityBenchmark([plan]);
 assert.equal(report.failedCases,1);
 assert.equal(report.passRate,0);
 assert.equal(report.issueCounts.critical,1);
});
test("rejects empty, unknown and duplicate case plans",()=>{
 assert.throws(()=>runVideoContinuityBenchmark([]),/non-empty/);
 assert.throws(()=>runVideoContinuityBenchmark([{caseId:"VID-999",shots:[]}]),/unknown/);
 const plan=validPlan(VIDEO_BENCHMARK_CASES[0]);
 assert.throws(()=>runVideoContinuityBenchmark([plan,plan]),/Duplicate/);
});