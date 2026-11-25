import test from "node:test";
import assert from "node:assert/strict";
import { IMAGE_BENCHMARK_CASES, IMAGE_BENCHMARK_CASE_COUNT, IMAGE_BENCHMARK_CATEGORY_COUNT } from "./image-benchmark-cases.mjs";

test("provides at least 100 unique synthetic image cases across all categories", () => {
  assert.equal(IMAGE_BENCHMARK_CASE_COUNT, 110);
  assert.equal(IMAGE_BENCHMARK_CASES.length, IMAGE_BENCHMARK_CASE_COUNT);
  assert.equal(new Set(IMAGE_BENCHMARK_CASES.map((item) => item.id)).size, IMAGE_BENCHMARK_CASES.length);
  assert.equal(new Set(IMAGE_BENCHMARK_CASES.map((item) => item.category)).size, IMAGE_BENCHMARK_CATEGORY_COUNT);
  assert.equal(IMAGE_BENCHMARK_CATEGORY_COUNT, 11);
  for (const item of IMAGE_BENCHMARK_CASES) {
    assert.match(item.id, /^IMG-\d{3}$/);
    assert.ok(item.prompt.length > 20);
  }
});

test("covers core fidelity stressors such as exact counts, placement and exact text", () => {
  const prompts = IMAGE_BENCHMARK_CASES.map((item) => item.prompt).join("\n");
  assert.match(prompts, /exactly five red apples/i);
  assert.match(prompts, /left third/i);
  assert.match(prompts, /exact words/i);
  assert.match(prompts, /Ardhanarishvara/i);
});
