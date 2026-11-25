import test from "node:test";
import assert from "node:assert/strict";
import { evaluateVideoContinuityPlan } from "./video-continuity-preflight.mjs";

const shots=[0,1,2].map((n)=>({shotNumber:n+1,subjectId:"runner-01",wardrobeId:"track-kit-01",cameraSide:"left",screenDirection:"left-to-right",actionProgress:n}));
test("passes a complete structurally continuous video plan",()=>{
 const result=evaluateVideoContinuityPlan({caseId:"VID-001",shots});
 assert.equal(result.passed,true);
 assert.equal(result.structuralScore,5);
 assert.deepEqual(result.issues,[]);
 assert.match(result.scope,/metadata-only/);
});
test("flags identity, wardrobe, prop, axis, direction and temporal drift",()=>{
 const result=evaluateVideoContinuityPlan({caseId:"VID-001",shots:[
  shots[0],
  {...shots[1],subjectId:"different-person",wardrobeId:"red-coat",cameraSide:"right",screenDirection:"right-to-left",actionProgress:0},
  shots[2],
 ]});
 assert.equal(result.passed,false);
 for (const code of ["subject-identity","wardrobe-drift","camera-axis","screen-direction","temporal-progression","unmotivated-axis-change","unmotivated-direction-change"]) {
  assert.ok(result.issues.some((issue)=>issue.code===code),code);
 }
});
test("checks required prop continuity and motivated camera-axis changes",()=>{
 const good=[0,1,2].map((n)=>({shotNumber:n+1,subjectId:"bottle-01",propIds:["cap-01","label-01"],cameraSide:n===1?"left":"right",actionProgress:n,axisChangeMotivated:n>0}));
 const result=evaluateVideoContinuityPlan({caseId:"VID-002",shots:good});
 assert.equal(result.issues.some((issue)=>issue.code==="unmotivated-axis-change"),false);
 const broken=good.map((shot)=>({...shot,propIds:["cap-01"]}));
 assert.equal(evaluateVideoContinuityPlan({caseId:"VID-002",shots:broken}).issues.filter((issue)=>issue.code==="prop-continuity").length,3);
});
test("rejects unknown cases, incorrect shot counts and malformed metadata",()=>{
 assert.throws(()=>evaluateVideoContinuityPlan({caseId:"VID-999",shots}),/Unknown/);
 assert.throws(()=>evaluateVideoContinuityPlan({caseId:"VID-001",shots:shots.slice(0,2)}),/exactly 3/);
 assert.throws(()=>evaluateVideoContinuityPlan({caseId:"VID-001",shots:[...shots.slice(0,2),{...shots[2],screenDirection:"diagonal"}]}),/invalid screenDirection/);
 assert.throws(()=>evaluateVideoContinuityPlan({caseId:"VID-001",shots:[...shots.slice(0,2),{...shots[2],shotNumber:2}]}),/unique integers/);
});
test("does not mistake metadata preflight for rendered video quality",()=>{
 const result=evaluateVideoContinuityPlan({caseId:"VID-001",shots});
 assert.match(result.scope,/not rendered-video or perceptual quality/);
});