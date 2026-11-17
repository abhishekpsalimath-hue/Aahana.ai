# Aahana Autonomous Creative and Knowledge Engines

## Product decision

Aahana owns the user experience, orchestration, project format, asset library, rendering pipeline, evaluation and knowledge layer. No third-party generation-provider API, hosted generation UI, account, SDK or proprietary job system is a runtime dependency.

This does not mean compute or model weights are free. Model training/inference requires hardware, storage, bandwidth and model licenses. Until Aahana operates its own inference infrastructure, capabilities must be labelled honestly as local/procedural, experimental, or unavailable—not presented as full AI image/video generation.

## Architecture principles

1. **Aahana-native contracts.** All engines expose Aahana-owned request, job, asset and error schemas. Providers are not exposed to the client.
2. **Replaceable model weights.** Prefer open-weight models with commercial-use rights compatible with Aahana. Pin model revisions, licenses, checksums and safety configuration.
3. **Self-hosted inference.** Run model workers on Aahana-controlled GPU infrastructure. No calls to external image/video/3D generation APIs. A future self-hosted GPU node is infrastructure, not a third-party creative service.
4. **Local-first creative tools.** Browser-native SVG, Canvas, WebGL/Three.js and WebCodecs/MediaRecorder should deliver useful diagrams, procedural illustrations, 3D scenes and timeline previews without a remote model call.
5. **Honest capability states.** Distinguish generated-by-model, procedurally-rendered, imported, draft, queued, failed and exported assets.
6. **Safety and provenance.** Validate prompts and uploads, moderate inputs/outputs, scan files, record model/license/version and generation parameters, and respect consent and copyright.
7. **No secret leakage.** GPU worker credentials and storage keys remain server-side. Every asset and job is scoped to its owner with Supabase RLS and server-side ownership checks.
8. **Production safety.** Work on `feat/aahana-learning-studio`; never deploy to production without explicit approval.

## Engine map

### Aahana Image Engine
- Phase A: native SVG/canvas composition, typography, charts, diagrams, layers, masks, crop, resize and export.
- Phase B: self-hosted text-to-image and image-to-image diffusion inference, prompt conditioning, seed/reproducibility, negative prompts, inpainting and upscaling.
- Store original prompt, model revision, seed, dimensions, safety result and output asset metadata.

### Aahana Motion Engine
- Phase A: native timeline and scene graph; keyframes, easing, camera paths, particles, text animation, transitions and audio tracks; preview and export where browser codecs permit.
- Phase B: self-hosted video diffusion/image-to-video workers, frame interpolation, super-resolution and temporal consistency checks.
- Explicitly report codec/browser limitations; do not claim an export format until verified.

### Aahana 3D Engine
- Build on the existing Three.js foundation.
- Native procedural geometry, parametric meshes, materials, lighting, camera controls, rigging/animation primitives and scene editor.
- Import/export GLB/glTF; validate geometry, texture budgets and file sizes.
- Later: self-hosted text/image-to-3D inference and mesh cleanup/retopology workers.

### Aahana Knowledge Engine
- Separate retrieval, source ranking, claim extraction, contradiction checks, citation generation and freshness policy from the chat response.
- Use Aahana-owned crawlers/connectors only where permitted; respect robots, rate limits, copyright and source terms.
- Build a versioned knowledge corpus from licensed/open sources, with provenance and update timestamps.
- Clearly distinguish model knowledge, retrieved evidence, inference and uncertainty. No fabricated citations.

## Shared platform services
- `POST /api/studio/jobs`: create a typed Aahana job after auth, validation, quota and ownership checks.
- `GET /api/studio/jobs/:id`: status/progress/error; enforce owner access.
- `POST /api/studio/jobs/:id/cancel`: cooperative cancellation.
- `GET /api/studio/assets` and signed, owner-scoped asset delivery.
- Job states: `queued`, `running`, `succeeded`, `failed`, `canceled`.
- Asset records include engine, kind, owner, storage key, mime type, dimensions/duration, provenance, model/license metadata and timestamps.
- Use a durable queue and isolated workers; never run long GPU inference in a normal Next.js request handler.
- Add per-engine resource budgets, concurrency controls, retries, idempotency and abuse protection. Keep ordinary Basic text chat unlimited; resource-intensive media can have transparent compute limits.

## Delivery sequence

1. Inventory current code, auth, RLS, storage and hosting constraints; write threat and cost model.
2. Build the Aahana-native asset/job contracts and local-first Image Studio (SVG/canvas editor and export).
3. Upgrade Creator Studio to use the shared asset library and scene/timeline model.
4. Build the native Motion Studio preview/export pipeline.
5. Expand Three.js into a real 3D authoring workspace and GLB export.
6. Provision Aahana-controlled GPU inference; benchmark open-weight image models first, then video and 3D. Do not promise timelines until a real GPU budget and benchmarks exist.
7. Build the Knowledge Engine's retrieval and evidence evaluation; add licensed corpus ingestion and source refresh.
8. Run unit, integration, security, ownership/RLS, load, accessibility and end-to-end tests before any production release.

## Current verified starting point (repository inspection)
- Next.js App Router, React, Supabase SSR/client and Three.js are installed.
- Creator Studio currently edits a lesson sequence and stores drafts in browser localStorage; its own UI says rendering/publishing is not connected.
- Learning Studio already loads a Three.js interactive world.
- Chat research policy in `src/app/api/chat/route.js` is mostly freshness/keyword-triggered; it is not yet a full research pipeline.
- Existing image route/provider configuration must be audited and either removed from the product path or replaced with Aahana-owned inference. Do not silently route generation to an external vendor.
- Current README lists Tavily for live research and Vercel for hosting. Hosting the web app is not the same as owning model inference.
- No generation engine should be labelled operational until a signed-in user can create, inspect, save and export a real asset in an end-to-end test.

## Explicit non-goals
- Do not build a thin wrapper around a generation vendor.
- Do not imply Aahana has trained a foundation model when it has not.
- Do not download or deploy model weights without checking license, memory, hardware and safety requirements.
- Do not use user content for training without clear opt-in and policy.
- Do not replace production or alter unrelated BuTTi, BANDI or SavorA projects.
