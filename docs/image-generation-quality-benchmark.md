# Aahana AI — image-generation quality benchmark

## Purpose

Measure whether a model follows the user's brief across many kinds of images. A single impressive sample is not evidence of reliable accuracy. Run the same prompt set against every candidate model/version and compare results.

## Test matrix

Use the 32 prompts in `tests/image-quality-benchmark.test.mjs`. They cover:

- People, anatomy and hands
- Animals and natural subjects
- Product identity and small product details
- Architecture, interiors and landscapes
- Exact counts, spatial placement and negative space
- Typography, spelling and exact visible text
- Educational diagrams and scientific structure
- Food, fashion and culturally specific visual details
- Vehicles, illustration, stylized 3D and cinematic scenes
- Kannada, Hindi, Tamil, Telugu and Spanish prompts

Do not silently simplify a prompt, change its language, remove constraints or replace a named subject. Preserve the original brief for every model.

## Controlled run protocol

1. Record the provider, exact model identifier, model/version date, generation settings, output dimensions, seed (when supported), latency and any cost/credit consumption.
2. Use identical prompts, aspect ratios, quality settings and seed policy for every candidate model. If a model does not support a fixed seed, record that limitation.
3. Generate at least two independent outputs per prompt where budget permits. Do not select only the best output; score every output.
4. Randomize and blind the output labels before review so reviewers do not know which model produced an image.
5. Keep original outputs unchanged. Record failures and rejected samples, not only successful examples.
6. Run the same matrix after prompt, provider or model changes. Compare category-level and overall results rather than relying on a single average.

## Five-dimension scoring

Score each dimension from 1 to 5:

| Dimension | What to inspect |
| --- | --- |
| Brief fidelity | Correct subject identity, requested attributes, object count, pose/action, setting and language |
| Composition | Correct framing, viewpoint, spatial relationships, scale, placement and negative space |
| Visual integrity | Anatomy, geometry, object boundaries, perspective, physical plausibility and absence of artifacts |
| Style and finish | Requested medium, materials, lighting, color, detail, clarity and production polish |
| Text and factual structure | Exact requested wording, labels, diagram relationships and scientific/cultural details |

Score meanings:

- **1 — Failed:** major contradiction, wrong subject, missing key constraints or unusable artifacts.
- **2 — Weak:** several obvious errors; the image only loosely resembles the brief.
- **3 — Partial:** main idea is present but at least one important requirement is wrong or missing.
- **4 — Strong:** brief is substantially followed with only minor defects.
- **5 — Exacting:** all important constraints are respected and the result is clean and coherent.

For each output, record a short reason for every score below 4 and tag concrete failures (wrong count, wrong identity, anatomy, layout, text, style drift, cultural mismatch, hallucinated object, malformed geometry, clipping, or other).

## Hard-failure checks

Regardless of average score, flag an output as a hard failure if it:
- Changes a named person, deity, animal, product or other requested subject into a different subject.
- Violates an explicitly requested exact count.
- Reverses or materially changes a required spatial relationship.
- Omits a critical required attribute or invents a conflicting one.
- Renders materially incorrect exact text or labels.
- Produces unsafe or unusable structural artifacts.

## Reporting

Report:
- Number of prompts and outputs attempted, completed and failed.
- Mean and median for each of the five dimensions.
- Per-category scores and hard-failure rate.
- Results by language and style.
- Most frequent failure tags with representative examples.
- Model/version, settings, latency and measured cost.
- A side-by-side comparison against the previous baseline.

Do not call image quality improved unless the same controlled test matrix shows a measurable improvement without a material regression in another dimension. Prompt-construction unit tests are useful regression protection, but they do not measure generated-image quality.

## Release gate

A candidate is ready for broader evaluation only when:
- The automated prompt-contract tests pass.
- All test prompts remain intact through the generation request path.
- The controlled output review is complete.
- No critical hard-failure regression is hidden by the average score.
- The exact model, settings, results and limitations are documented.

No paid generation should be started automatically by this benchmark. Running live comparisons requires explicit budget/provider approval.
