import { summarizeImageSampleReviews } from "./image-sample-review.mjs";
import { summarizeVideoSampleReviews } from "./video-sample-review.mjs";
import { summarizeImageBenchmark } from "./image-benchmark.mjs";

/**
 * Unified envelope for independent evidence streams. Image and video metrics
 * intentionally remain separate because their rubrics are not interchangeable.
 */
export function buildCreativeEvaluationReport({imageReviews=[],videoReviews=[],imageBenchmarkResults=[]}={}) {
  if (!Array.isArray(imageReviews) || !Array.isArray(videoReviews) || !Array.isArray(imageBenchmarkResults)) {
    throw new TypeError("Creative evaluation inputs must be arrays.");
  }
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    evidenceScope:"Offline summaries of supplied metadata and human ratings; no provider calls or media inspection.",
    image:{
      humanOutputReviews:imageReviews.length ? summarizeImageSampleReviews(imageReviews) : [],
      promptBenchmark:imageBenchmarkResults.length ? summarizeImageBenchmark(imageBenchmarkResults) : [],
    },
    video:{
      humanShotReviews:videoReviews.length ? summarizeVideoSampleReviews(videoReviews) : [],
      structuralPreflight:"Not included in human output scores; run evaluateVideoContinuityPlan separately for shot-plan metadata.",
    },
    comparisonPolicy:"Do not compare image and video averages, acceptance rates, or reviewer spreads as if they shared one rubric.",
  });
}
