import { summarizeImageSampleReviews } from "./image-sample-review.mjs";
import { summarizeVideoSampleReviews } from "./video-sample-review.mjs";
import { summarizeImageBenchmark } from "./image-benchmark.mjs";
import { runVideoContinuityBenchmark } from "./video-benchmark-runner.mjs";
import { compareVideoBenchmarkRuns } from "./benchmark-regression.mjs";
import { createBenchmarkSnapshot } from "./benchmark-snapshot.mjs";

/**
 * Unified envelope for independent evidence streams. Image and video metrics
 * intentionally remain separate because their rubrics are not interchangeable.
 */
export function buildCreativeEvaluationReport({
  imageReviews=[],
  videoReviews=[],
  imageBenchmarkResults=[],
  videoContinuityPlans=[],
  videoBaselineRun=null,
  snapshotProvenance=null,
}={}) {
  if (!Array.isArray(imageReviews) || !Array.isArray(videoReviews) || !Array.isArray(imageBenchmarkResults) || !Array.isArray(videoContinuityPlans)) {
    throw new TypeError("Creative evaluation inputs must be arrays.");
  }
  if (videoBaselineRun && !videoContinuityPlans.length) {
    throw new TypeError("A video baseline requires candidate video continuity plans.");
  }
  if (snapshotProvenance && !videoContinuityPlans.length) {
    throw new TypeError("Video snapshot provenance requires candidate video continuity plans.");
  }
  const structuralPreflight=videoContinuityPlans.length ? runVideoContinuityBenchmark(videoContinuityPlans) : null;
  const regression=videoBaselineRun ? compareVideoBenchmarkRuns({baseline:videoBaselineRun,candidate:structuralPreflight}) : null;
  const snapshot=snapshotProvenance ? createBenchmarkSnapshot({
    ...snapshotProvenance,
    benchmark:structuralPreflight.benchmark,
    results:structuralPreflight.results,
  }) : null;
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    evidenceScope:"Offline summaries of supplied metadata and human ratings; no provider calls or media inspection.",
    image:{
      humanOutputReviews:imageReviews.length ? summarizeImageSampleReviews(imageReviews) : [],
      promptBenchmark:imageBenchmarkResults.length ? summarizeImageBenchmark(imageBenchmarkResults) : [],
    },
    video:{
      humanShotReviews:videoReviews.length ? summarizeVideoSampleReviews(videoReviews) : [],
      structuralPreflight,
      regression,
      reproducibleSnapshot:snapshot,
    },
    comparisonPolicy:"Do not compare image and video averages, acceptance rates, or reviewer spreads as if they shared one rubric.",
  });
}
