import test from "node:test";
import assert from "node:assert/strict";
import { createBenchmarkSnapshot } from "./benchmark-snapshot.mjs";
import { compareBenchmarkModels } from "./benchmark-model-comparison.mjs";

const make=(modelLabel,runAt,score,overrides={})=>createBenchmarkSnapshot({
 benchmark:"video-continuity-metadata-v1",benchmarkVersion:"v1",commitSha:runAt,modelLabel,runAt,
 results:[
  {caseId:"VID-001",category:"character",structuralScore:score,passed:score>=80},
  {caseId:"VID-002",category:"product",structuralScore:score-5,passed:score>=80},
 ],
 ...overrides,
});

test("compares model snapshots on the same benchmark and exact case set",()=>{
 const result=compareBenchmarkModels([
  make("model-a","2026-11-25T10:00:00Z",80),
  make("model-a","2026-11-25T11:00:00Z",90),
  make("model-b","2026-11-25T10:30:00Z",85),
 ]);
 assert.equal(result.models.length,2);
 assert.equal(result.models[0].modelLabel,"model-a");
 assert.equal(result.models[0].changeSincePrevious.averageStructuralScore,10);
 assert.deepEqual(result.comparison.rankedByAverageStructuralScore,["model-a","model-b"]);
 assert.equal(result.models[0].latest.evaluatedCases,2);
});

test("reports per-category metrics without mixing categories",()=>{
 const result=compareBenchmarkModels([
  make("model-a","2026-11-25T10:00:00Z",90),
  make("model-b","2026-11-25T11:00:00Z",85),
 ]);
 assert.equal(result.models[0].latest.categories.character.cases,1);
 assert.equal(result.models[0].latest.categories.product.cases,1);
});

test("rejects incompatible benchmark versions and case sets",()=>{
 const a=make("model-a","2026-11-25T10:00:00Z",90);
 assert.throws(()=>compareBenchmarkModels([a,make("model-b","2026-11-25T11:00:00Z",90,{benchmarkVersion:"v2"})]),/same benchmark and version/);
 assert.throws(()=>compareBenchmarkModels([a,make("model-b","2026-11-25T11:00:00Z",90,{results:[{caseId:"VID-003",category:"character",structuralScore:90,passed:true}]})]),/identical evaluated case set/);
});

test("rejects tampered and duplicate snapshots",()=>{
 const a=make("model-a","2026-11-25T10:00:00Z",90);
 const b=make("model-b","2026-11-25T11:00:00Z",90);
 assert.throws(()=>compareBenchmarkModels([a,{...b,digest:"tampered"}]),/invalid snapshot digest/);
 assert.throws(()=>compareBenchmarkModels([a,a]),/Duplicate/);
});

test("requires two snapshots and chronological runs within each model",()=>{
 assert.throws(()=>compareBenchmarkModels([]),/At least two/);
 assert.throws(()=>compareBenchmarkModels([
  make("model-a","2026-11-25T11:00:00Z",90),
  make("model-a","2026-11-25T10:00:00Z",91),
 ]),/strictly chronological/);
});
