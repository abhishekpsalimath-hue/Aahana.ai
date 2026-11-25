import test from "node:test";
import assert from "node:assert/strict";
import { compareVideoBenchmarkRuns } from "./benchmark-regression.mjs";

const run = (overrides = {}) => ({
  benchmark:"video-continuity-metadata-v1", catalogueCases:2, coverageRate:1, passRate:0.5,
  averageStructuralScore:80, issueCounts:{critical:0,major:1},
  results:[{caseId:"VID-001",passed:true,structuralScore:90,category:"character"},{caseId:"VID-002",passed:false,structuralScore:70,category:"product"}],
  ...overrides,
});
const candidateResults=(first,second)=>[
 {caseId:"VID-001",passed:first.passed,structuralScore:first.score,category:"character"},
 {caseId:"VID-002",passed:second.passed,structuralScore:second.score,category:"product"},
];

test("detects pass-rate, case-level, category-level and severity regressions", () => {
 const result=compareVideoBenchmarkRuns({baseline:run(),candidate:run({passRate:0,averageStructuralScore:70,issueCounts:{critical:1,major:2},results:candidateResults({passed:false,score:75},{passed:false,score:65})})});
 assert.equal(result.status,"regression-detected");
 assert.ok(result.regressions.includes("pass-rate-decreased"));
 assert.ok(result.regressions.includes("category-level-regressions"));
 assert.ok(result.caseRegressions.length>0);
 assert.ok(result.categoryRegressions.some((item)=>item.category==="character"));
 assert.equal(result.deltas.issueCounts.critical,1);
});

test("reports improvements without calling them regressions", () => {
 const result=compareVideoBenchmarkRuns({baseline:run(),candidate:run({passRate:1,averageStructuralScore:90,issueCounts:{critical:0,major:0},results:candidateResults({passed:true,score:95},{passed:true,score:85})})});
 assert.equal(result.status,"no-regression-detected");
 assert.equal(result.caseImprovements.length,2);
 assert.equal(result.categoryImprovements.length,2);
});

test("rejects different benchmarks, catalogue sizes and case sets", () => {
 assert.throws(()=>compareVideoBenchmarkRuns({baseline:run(),candidate:run({benchmark:"image-v1"})}),/matching video benchmark/);
 assert.throws(()=>compareVideoBenchmarkRuns({baseline:run(),candidate:run({catalogueCases:3})}),/catalogue size/);
 assert.throws(()=>compareVideoBenchmarkRuns({baseline:run(),candidate:run({results:[{caseId:"VID-001",passed:true,structuralScore:90,category:"character"}]})}),/identical evaluated case set/);
});

test("rejects category changes and invalid thresholds or metrics", () => {
 assert.throws(()=>compareVideoBenchmarkRuns({baseline:run(),candidate:run({results:[{caseId:"VID-001",passed:true,structuralScore:90,category:"product"},{caseId:"VID-002",passed:false,structuralScore:70,category:"product"}]})}),/category changed/);
 assert.throws(()=>compareVideoBenchmarkRuns({baseline:run(),candidate:run(),minimumScoreDrop:-1}),/cannot be negative/);
 assert.throws(()=>compareVideoBenchmarkRuns({baseline:run({passRate:NaN}),candidate:run()}),/finite number/);
});
