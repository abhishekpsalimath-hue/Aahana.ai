import test from "node:test";
import assert from "node:assert/strict";
import { createBenchmarkSnapshot } from "./benchmark-snapshot.mjs";

const input=(overrides={})=>({benchmark:"video-continuity",benchmarkVersion:"v1",commitSha:"abc123",modelLabel:"offline-preflight",runAt:"2026-11-25T12:00:00Z",results:[{caseId:"VID-001",score:90,passed:true,metadata:{z:1,a:2}}],...overrides});

test("snapshot digest is stable across object key order",()=>{
  const a=createBenchmarkSnapshot(input());
  const b=createBenchmarkSnapshot(input({results:[{metadata:{a:2,z:1},passed:true,score:90,caseId:"VID-001"}]}));
  assert.equal(a.digest,b.digest);
  assert.equal(a.schemaVersion,1);
});

test("snapshot is immutable and records provenance",()=>{
  const snapshot=createBenchmarkSnapshot(input());
  assert.equal(snapshot.commitSha,"abc123");
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.results[0]));
});

test("rejects missing provenance, invalid time and non-JSON values",()=>{
  assert.throws(()=>createBenchmarkSnapshot(input({commitSha:""})),/commitSha is required/);
  assert.throws(()=>createBenchmarkSnapshot(input({runAt:"yesterday"})),/UTC ISO-8601/);
  assert.throws(()=>createBenchmarkSnapshot(input({results:[{score:Infinity}]})),/non-finite/);
  assert.throws(()=>createBenchmarkSnapshot(input({results:[{score:undefined}]})),/undefined/);
});
