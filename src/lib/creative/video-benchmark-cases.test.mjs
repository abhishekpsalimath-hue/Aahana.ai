import test from "node:test";
import assert from "node:assert/strict";
import { VIDEO_BENCHMARK_CASES, VIDEO_BENCHMARK_CATEGORIES, getVideoBenchmarkCase } from "./video-benchmark-cases.mjs";

test("video benchmark catalogue has unique stable IDs and valid multi-shot contracts",()=>{
 assert.equal(VIDEO_BENCHMARK_CASES.length,12);
 assert.equal(new Set(VIDEO_BENCHMARK_CASES.map((item)=>item.id)).size,12);
 assert.ok(VIDEO_BENCHMARK_CASES.every((item)=>item.shotCount>=2 && item.shotCount<=12 && item.required.includes("subjectId")));
 assert.ok(VIDEO_BENCHMARK_CATEGORIES.includes("temporal-progression"));
 assert.equal(getVideoBenchmarkCase("VID-007").expected.subjectId,"glass-01");
 assert.equal(getVideoBenchmarkCase("VID-999"),null);
});
test("benchmark case contracts are immutable",()=>{
 assert.ok(Object.isFrozen(VIDEO_BENCHMARK_CASES));
 assert.ok(Object.isFrozen(VIDEO_BENCHMARK_CASES[0].required));
 assert.ok(Object.isFrozen(VIDEO_BENCHMARK_CASES[0].expected.actionProgress));
});