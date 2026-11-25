import test from "node:test";
import assert from "node:assert/strict";
import { createBenchmarkSnapshot } from "./benchmark-snapshot.mjs";
import { analyzeBenchmarkHistory } from "./benchmark-history.mjs";

const make=(runAt,score,passed=true,overrides={})=>createBenchmarkSnapshot({
 benchmark:"video-continuity",benchmarkVersion:"v1",commitSha:runAt,modelLabel:"offline-preflight",runAt,
 results:[
  {caseId:"VID-001",category:"character",structuralScore:score,passed},
  {caseId:"VID-002",category:"product",structuralScore:score,passed},
 ],
 ...overrides,
});

test("analyzes chronological snapshots and identifies regressions",()=>{
 const history=analyzeBenchmarkHistory([
  make("2026-11-25T10:00:00Z",90,true),
  make("2026-11-25T11:00:00Z",80,false),
  make("2026-11-25T12:00:00Z",95,true),
 ]);
 assert.equal(history.snapshots.length,3);
 assert.equal(history.transitions.length,2);
 assert.equal(history.transitions[0].status,"regression-detected");
 assert.equal(history.transitions[1].status,"improved-or-mixed");
 assert.equal(history.overallTrend,"regressions-present");
 assert.equal(history.transitions[0].categoryDeltas.character.passRate,-1);
});

test("rejects invalid digests, benchmark versions and non-chronological history",()=>{
 const first=make("2026-11-25T10:00:00Z",90);
 const second=make("2026-11-25T11:00:00Z",91);
 assert.throws(()=>analyzeBenchmarkHistory([first,{...second,digest:"bad"}]),/invalid snapshot digest/);
 assert.throws(()=>analyzeBenchmarkHistory([first,make("2026-11-25T11:00:00Z",91,true,{benchmarkVersion:"v2"})]),/same benchmark and version/);
 assert.throws(()=>analyzeBenchmarkHistory([second,first]),/strictly chronological/);
 assert.throws(()=>analyzeBenchmarkHistory([first,first]),/strictly chronological/);
});

test("rejects changed evaluated case sets",()=>{
 const first=make("2026-11-25T10:00:00Z",90);
 const second=make("2026-11-25T11:00:00Z",91,true,{results:[{caseId:"VID-001",category:"character",structuralScore:91,passed:true}]});
 assert.throws(()=>analyzeBenchmarkHistory([first,second]),/identical evaluated case set/);
});

test("rejects fewer than two snapshots",()=>{
 assert.throws(()=>analyzeBenchmarkHistory([]),/At least two/);
});
