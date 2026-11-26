# Reference-image edit review protocol

Status: human-review protocol for isolated engineering evaluation. This is not an automated vision metric and does not establish model accuracy by itself.

## Purpose

Evaluate whether an image edit makes the requested change while preserving everything the user did not ask to change. Never use customer uploads, private account media, or personal conversations as benchmark fixtures. Use synthetic or explicitly approved test images and keep review artifacts outside production storage.

## Review dimensions

Score each applicable dimension from 1 (unacceptable) to 5 (excellent). Mark text as `null` only when the output contains no text whose fidelity is relevant.

| Dimension | Weight | What reviewers check |
|---|---:|---|
| Identity fidelity | 25% | Same recognizable person or exact source object; no face substitution or identity drift |
| Anatomy and proportions | 15% | Natural body proportions, joints, hands, fingers, facial structure and object geometry |
| Requested edit accuracy | 20% | The requested pose, outfit, background, enhancement or design change is actually completed |
| Unrequested detail preservation | 20% | Protected face, body, clothing, accessories, lighting, scene and details remain unchanged |
| Composition and framing | 10% | Camera viewpoint, crop, perspective, subject placement and aspect ratio remain appropriate |
| Text and graphic fidelity | 10% | Supplied wording, spelling, dates, layout and source labels are preserved or changed only as requested |

## Verdict rules

The evaluator in `src/lib/creative/reference-image-evaluation.mjs` applies the weights above.

- A review is **incomplete** until identity, anatomy, requested edit accuracy and preservation have explicit scores.
- A review is **revise** if any critical dimension is below 4, or the weighted average of applicable dimensions is below 4.
- A review is **pass** only when every critical dimension is at least 4 and the weighted average is at least 4.
- Do not average away a failed identity or anatomy score with high scores elsewhere.
- Do not score a dimension as not applicable merely because the output is difficult to assess; record uncertainty and request another review.

## Controlled comparison procedure

1. Record a case ID, synthetic source-image description, exact edit instruction, provider/model identifier, settings, timestamp and output identifier.
2. Use the same source image and instruction for each model comparison. Keep seeds and dimensions identical where the provider supports them.
3. Review source and output side by side at the same display scale. Inspect the face, body, hands, clothing, background boundaries, text and full composition.
4. Score each dimension independently before assigning a verdict. Have a second reviewer assess identity-sensitive cases when practical.
5. Record visible defects and the exact region affected. Preserve failed results in the report to make regressions visible.
6. Repeat a case when provider output is transiently unavailable; do not count provider errors as image-quality failures.
7. Compare pass rate and per-dimension scores across the same case set. Report sample size and model/settings alongside every percentage.

## Required case coverage

Include at least one case for each of these edit intents:

- Portrait enhancement without changing face, pose or clothing
- Couple pose change while preserving both identities and outfits
- Wardrobe replacement while preserving face and body proportions
- Background replacement while preserving foreground subjects and objects
- Poster/banner composition with exact user-supplied copy and no invented contact details
- Product-photo edit preserving label, shape and camera angle

## Reporting language

A passing score means the reviewed output met this rubric for that case. It does not mean 100% identity accuracy, guarantee future outputs, or prove performance across all people, devices, prompts or models. Never claim “100% accurate” from prompt tests or a small human-reviewed sample.

## Privacy and release boundary

Do not upload private user photos to third-party providers for benchmark purposes without explicit permission and a clear provider/data-retention review. Do not enable a new provider, change production routing, alter feature flags, or spend provider credits as part of this protocol. A successful prompt-level test is not a substitute for visual review of real outputs.
