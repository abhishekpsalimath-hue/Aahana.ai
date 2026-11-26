# Aahana Video Studio: Competitive Architecture and Release Plan

Status: engineering blueprint. This document does not claim that the capabilities below are implemented or available in production.

## Product promise

Aahana Video Studio should let a person describe the result in natural language and move from idea to a finished, editable video. The default flow must not require choosing a model, style preset, aspect ratio, codec, frame rate, or technical setting. Advanced controls remain optional and are revealed only when useful.

The ambition is to compete with specialist video generation, editing, motion-design, and voice platforms as one coherent creative workflow. "Better than" is a target to prove with repeatable output tests and user outcomes, not a marketing claim.

## Current verified baseline

The current repository contains:
- An authenticated `POST /api/videos/generate` route.
- Text-to-video and image-to-video request paths.
- A single configured model identifier: `xai/grok-imagine-video`, called through the Cloudflare AI endpoint.
- A 1–15 second duration range, 480p/720p output choices, and several aspect ratios.
- An optional prompt director and basic continuity fields.
- A server-side feature gate (`AAHANA_VIDEO_GENERATION_ENABLED`) that keeps paid inference disabled unless explicitly enabled.
- Synthetic metadata-only continuity checks and a human review schema.

The current continuity preflight validates shot-plan metadata. It does not inspect generated frames, optical flow, identity, audio, lip sync, or perceptual video quality. The existing request route is a single synchronous provider call, not a durable multi-stage editing/rendering pipeline.

## Experience principles

1. **Prompt first:** accept ordinary language, image references, and iterative instructions. Technical controls are optional.
2. **Edit conversationally:** "make the camera slower", "keep her face unchanged", "replace the background", "add subtitles", and "make a 9:16 cut" should become targeted edit operations, not force a complete restart.
3. **Preserve references:** treat supplied images, approved character references, product identity, wardrobe, logos, and scene geometry as protected inputs unless the user requests a change.
4. **Keep the timeline editable:** generated shots, voice, music, captions, overlays, transitions, and effects should remain separate, reorderable tracks wherever the source formats allow.
5. **Never fake completion:** expose queued, generating, rendering, failed, completed, and export-ready states accurately. Never show a placeholder as a finished video.
6. **Privacy by design:** use private storage, short-lived signed access, explicit retention rules, and no customer media in benchmarks without explicit approval.
7. **Honest quality:** show the selected generation path and known limits. Do not promise perfect identity, lip sync, or exact text unless verified for that workflow.

## Capability map

### A. Generation
- Text-to-video and image-to-video.
- First-frame/last-frame guidance and keyframe interpolation.
- Multi-shot story generation from one brief, with shot list and storyboard approval.
- Character, product, wardrobe, prop, location, and visual-style continuity across shots.
- Camera motion, lens/framing, lighting, depth, motion intensity, and pacing controls.
- Multiple aspect ratios and output-quality tiers, selected automatically by default.
- Regeneration of one shot without discarding accepted shots.

### B. Editing and post-production
- Non-destructive timeline with video, audio, voice, music, captions, overlays, and effects tracks.
- Trim, split, reorder, crop, resize, speed changes, transitions, and scene-level regeneration.
- Background removal/replacement, object removal, masking, motion tracking, and compositing where supported by selected engines.
- Stabilization, denoise, frame interpolation, slow motion, color grading, and upscale as separate explicit operations.
- Automatic social cut-downs and platform-safe framing from a master edit.

### C. Voice and audio
- Script drafting, voice selection, multilingual narration, pronunciation controls, and voice timing.
- User-provided voice only with clear rights/consent confirmation; do not clone an identifiable voice by default.
- Music and sound-effect placement, ducking, fades, beat alignment, and mix controls.
- Captions, subtitle translation, speaker labels, and editable transcript timing.
- Lip-sync generation only through a provider path that supports it and after quality testing.

### D. Creative assistance
- Brief-to-script, scene outline, storyboard, shot prompts, and production plan.
- Brand kit support for logos, fonts, colors, product references, and reusable templates.
- Conversational revision with a visible change list and undo/redo.
- Export presets for social, advertising, education, product demos, and cinematic work.

## Architecture: provider-neutral orchestration

Do not bind the product to one model or one vendor. Keep a provider adapter contract behind an internal orchestration layer.

Suggested layers:
1. **Creative brief parser** — converts the natural-language request into an editable project brief, constraints, target platform, and optional shot plan.
2. **Project graph** — stores assets, shots, keyframes, tracks, edits, dependencies, and version history as structured data.
3. **Capability registry** — describes each provider/model's verified support: text/image/video inputs, duration, resolution, aspect ratios, keyframes, reference images, audio, lip sync, camera controls, commercial-use terms, geographic availability, latency, and cost metadata.
4. **Planner/router** — chooses only among configured and approved providers based on requested capabilities, quality evidence, availability, privacy, and cost limits. It must fail closed if no approved route satisfies the request.
5. **Durable job orchestration** — creates idempotent jobs, records stage progress, supports cancellation/retry, applies per-user quotas, and resumes safely after timeouts. Long renders must not depend on a single browser request remaining open.
6. **Asset pipeline** — validates uploads, stores private originals, creates derived proxies, tracks checksums and ownership, and applies retention/cleanup policies.
7. **Render/composition layer** — combines accepted generated clips with edit decisions, voice, music, captions, transitions, and overlays. Keep source assets and edit decisions recoverable.
8. **Evaluation and telemetry** — records provider/model version, generation settings, stage timings, failures, and human quality assessments without retaining unnecessary personal media.

The capability registry must distinguish **provider advertised support** from **Aahana verified support**. A feature is selectable only after both capability and quality gates pass.

## Quality benchmark: evidence before claims

Build a fixed, synthetic, rights-cleared evaluation set. Compare Aahana workflows against selected competitor workflows using equivalent briefs, references, duration, and output constraints.

Every evaluated sample should record:
- Prompt and case identifier, provider/model/version, generation settings, and date.
- Whether the request completed and whether the output was usable.
- Human ratings from at least two independent reviewers where practical.
- Dimension scores: subject/identity fidelity, motion naturalness, temporal coherence, camera control, scene continuity, requested-change accuracy, visual artifacts, audio quality, speech intelligibility, lip-sync alignment, text accuracy, and editability.
- Latency, retry rate, output resolution, and observed cost.

Use automated measurements only where they are valid (for example, frame-level technical checks or audio alignment); do not present metadata-only checks as perceptual quality. Report sample count, coverage, confidence/variance, and failure cases. Never claim superiority from a small or cherry-picked sample.

## Safety, cost, and release gates

- No new paid provider, account, subscription, model route, API key, or production inference is enabled by this blueprint.
- Keep paid inference feature-gated and disabled until the owner explicitly approves provider, budget/limits, and live activation.
- Provider credentials stay server-side; never expose them to browser code.
- Add rate limits, concurrency caps, upload/output size limits, timeout handling, cancellation, and cost ceilings before enabling generation.
- Keep current user accounts, conversations, settings, storage, and existing image workflows untouched.
- Do not change Student Mode as part of Video Studio work.
- Use isolated branches and draft PRs. Merge only after exact-head CI, security review, runtime tests, and deployment verification.
- Production deployment remains separate from engineering readiness.

## Phased delivery

### Phase 0 — Safe foundation
- Keep current endpoint gated.
- Add provider-neutral request/result contracts and capability registry.
- Replace assumptions about one synchronous provider response with a job interface.
- Add idempotency, job-state tests, cancellation semantics, quotas, and safe cleanup.
- Add a feature matrix showing what is implemented, gated, experimental, or unavailable.

### Phase 1 — Quality-first generation
- Integrate only owner-approved providers.
- Add text/image-to-video with storyboard and reference-image controls.
- Build real rendered-video evaluation, including identity, motion, temporal, and artifact review.
- Support targeted shot regeneration and prompt iteration.

### Phase 2 — Editing studio
- Add editable timeline, tracks, trimming, transitions, crop/resize, captions, overlays, and audio mixing.
- Preserve edit decisions and allow project revisions without destructive overwrite.
- Add export presets and reliable output download.

### Phase 3 — Advanced production
- Add keyframe workflows, multi-shot continuity, motion tracking, masking, background/object edits, upscale, interpolation, and stabilization where verified.
- Add voiceover, multilingual narration, sound design, and consent-based voice workflows.
- Add lip sync only after measurable alignment testing.

### Phase 4 — Competitive proof
- Run blind, repeatable comparisons against selected competing workflows.
- Publish internal scorecards and known limitations.
- Expand availability only when quality, reliability, privacy, and cost targets are met.

## Definition of done

A capability is not "done" because a button or prompt exists. It is done only when:
- The UI exposes a truthful supported workflow.
- The server validates input, authorization, cost, and provider capability.
- Jobs survive normal network interruptions and support cancellation/retry.
- Output is stored and delivered securely.
- Automated tests cover validation, failures, retries, and cleanup.
- Real rendered samples pass the agreed human/technical quality bar.
- Exact-head CI and production runtime checks pass.
- The feature is explicitly approved before any paid or production activation.
