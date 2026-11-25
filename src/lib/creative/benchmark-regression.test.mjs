import test from "node:test";
import assert from "node:assert/strict";
import { compareVideoBenchmarkRuns } from "./benchmark-regression.mjs";

const run = (overrides = {}) => ({
  benchmark:"video-continuity-metadata-v1", catalogueCases:2, coverageRate:1, passRate:0.5,
  averageStructuralScore:80, issueCounts:{critical:0,major:1},
  results:[{caseId:"VID-001",passed:true,structuralScore:90,category:"character"},{caseId:"VID-002",passed:false,structuralScore:70,category:"product"}],
  ...overrides,
});

test("detects pass-rate, case-level and severity regressions", () => {
  const result=compareVideoBenchmarkRuns({baseline:run(),candidate:run({passRate:0,averageStructuralScore:70,issueCounts:{critical:1,major:2},results:[{caseId:"VID-001",passed:false,structuralScore:75},{caseId:"VID-002",passed:false,structuralScore:65}]})});
  assert.equal(result.status,"regression-detected");
  assert.ok(result.regressions.includes("pass-rate-decreased"));
  assert.ok(result.caseRegressions.length>0);
  assert.equal(result.deltas.issueCounts.critical,1);
});

test("reports improvements without calling them regressions", () => {
  const result=compareVideoBenchmarkRuns({baseline:run(),candidate:run({passRate:1,averageStructuralScore:90,issueCounts:{critical:0,major:0},results:[{caseId:"VID-001",passed:true,structuralScore:95},{caseId:"VID-002",passed:true,structuralScore:85}]})});
  assert.equal(result.status,"no-regression-detected");
  assert.equal(result.caseImprovements.length,2);
});

test("rejects different benchmarks, catalogue sizes and case sets", () => {
  assert.throws(()=>compareVideoBenchmarkRuns({baseline:run(),candidate:run({benchmark:"image-v1"})}),/matching video benchmark/);
  assert.throws(()=>compareVideoBenchmarkRuns({baseline:run(),candidate:run({catalogueCases:3})}),/catalogue size/);
  assert.throws(()=>compareVideoBenchmarkRuns({baseline:run(),candidate:run({results:[{caseId:"VID-001",passed:true,structuralScore:90}]})}),/identical evaluated case set/);
});

test("rejects invalid thresholds and metrics", () => {
  assert.throws(()=>compareVideoBenchmarkRuns({baseline:run(),candidate:run(),minimumScoreDrop:-1}),/cannot be negative/);
  assert.throws(()=>compareVideoBenchmarkRuns({baseline:run({passRate:NaN}),candidate:run()}),/finite number/);
});
