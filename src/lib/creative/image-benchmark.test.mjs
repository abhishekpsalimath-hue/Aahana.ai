import test from "node:test";
import assert from "node:assert/strict";
import { summarizeImageBenchmark, IMAGE_BENCHMARK_DIMENSIONS, IMAGE_CASE_ACCEPTANCE_THRESHOLD } from "./image-benchmark.mjs";

function result(overrides = {}) {
  return {
    caseId: "IMG-001",
    model: "flux-test",
    category: "people",
    subjectFidelity: 4,
    attributeFidelity: 5,
    compositionFidelity: 3,
    constraintFidelity: 4,
    visualCoherence: 4,
    latencySeconds: 2,
    exactTextPass: true,
    ...overrides,
  };
}

test("defines a strict case-level acceptance threshold", () => {
  assert.equal(IMAGE_CASE_ACCEPTANCE_THRESHOLD, 4);
  const summary = summarizeImageBenchmark([
    result({ caseId: "IMG-001", subjectFidelity: 4, attributeFidelity: 4, compositionFidelity: 4, constraintFidelity: 4, visualCoherence: 4 }),
    result({ caseId: "IMG-002", subjectFidelity: 5, attributeFidelity: 5, compositionFidelity: 5, constraintFidelity: 3, visualCoherence: 5 }),
  ])[0];
  assert.equal(summary.acceptedCases, 1);
  assert.equal(summary.caseAcceptanceRate, 0.5);
  assert.equal(summary.acceptanceThreshold, 4);
});

test("exposes the five fixed scoring dimensions", () => {
  assert.deepEqual(IMAGE_BENCHMARK_DIMENSIONS, [
    "subjectFidelity", "attributeFidelity", "compositionFidelity",
    "constraintFidelity", "visualCoherence",
  ]);
});

test("summarizes per-model dimensions, text pass rate, latency and categories", () => {
  const summaries = summarizeImageBenchmark([
    result(),
    result({
      caseId: "IMG-011",
      category: "products",
      subjectFidelity: 2,
      attributeFidelity: 3,
      compositionFidelity: 4,
      constraintFidelity: 3,
      visualCoherence: 4,
      latencySeconds: 4,
      exactTextPass: false,
    }),
    result({ model: "other-model", latencySeconds: undefined, exactTextPass: undefined }),
  ]);

  assert.equal(summaries.length, 2);
  const first = summaries.find((item) => item.model === "flux-test");
  assert.equal(first.cases, 2);
  assert.equal(first.averageScore, 3.6);
  assert.deepEqual(first.dimensions, {
    subjectFidelity: 3,
    attributeFidelity: 4,
    compositionFidelity: 3.5,
    constraintFidelity: 3.5,
    visualCoherence: 4,
  });
  assert.equal(first.exactTextPassRate, 0.5);
  assert.equal(first.exactTextCases, 2);
  assert.equal(first.averageLatencySeconds, 3);
  assert.equal(first.categoryScores.people.cases, 1);
  assert.equal(first.categoryScores.products.averageScore, 3.2);
  const second = summaries.find((item) => item.model === "other-model");
  assert.equal(second.exactTextPassRate, null);
  assert.equal(second.averageLatencySeconds, null);
});

test("sorts model names and does not mutate input rows", () => {
  const rows = [result({ model: "z-model" }), result({ model: "a-model" })];
  const before = structuredClone(rows);
  const summary = summarizeImageBenchmark(rows);
  assert.deepEqual(summary.map((item) => item.model), ["a-model", "z-model"]);
  assert.deepEqual(rows, before);
});

test("rejects empty input, missing identifiers and invalid scores", () => {
  assert.throws(() => summarizeImageBenchmark([]), /at least one/);
  assert.throws(() => summarizeImageBenchmark([{}]), /caseId/);
  assert.throws(() => summarizeImageBenchmark([result({ subjectFidelity: 6 })]), /subjectFidelity/);
  assert.throws(() => summarizeImageBenchmark([result({ compositionFidelity: -1 })]), /compositionFidelity/);
  assert.throws(() => summarizeImageBenchmark([result({ visualCoherence: NaN })]), /visualCoherence/);
});

test("rejects unknown case IDs and category mismatches against the synthetic case catalog", () => {
  assert.throws(() => summarizeImageBenchmark([result({ caseId: "IMG-999" })]), /unknown benchmark case/);
  assert.throws(() => summarizeImageBenchmark([result({ caseId: "IMG-001", category: "products" })]), /category does not match/);
});

test("rejects duplicate model and case pairs and malformed optional metrics", () => {
  assert.throws(() => summarizeImageBenchmark([result(), result()]), /Duplicate result/);
  assert.throws(() => summarizeImageBenchmark([result({ latencySeconds: -1 })]), /latencySeconds/);
  assert.throws(() => summarizeImageBenchmark([result({ exactTextPass: "yes" })]), /exactTextPass/);
});
