# Aahana AI — Core Assistant knowledge architecture

## What is active in this branch

- The Core Assistant uses the configured Groq model and a dedicated knowledge standard for non-Student modes.
- The knowledge standard encourages first-principles explanations, cross-domain reasoning, explicit assumptions, consistency checks, and honest uncertainty.
- Existing chat infrastructure keeps a bounded recent conversation history and supports private, account-scoped memory only when the user enables it.
- The chat route has an opt-in live-research path for freshness-sensitive requests. It uses Tavily only when a server key is configured and validates citations against the URLs retrieved for that request.
- The image endpoint now optionally asks the configured Groq model to refine the image prompt before calling the existing FLUX.1-schnell image model. If refinement is unavailable, times out, or returns unusable output, the original prompt is used.
- The public introduction is isolated from the signed-in workspace and contains a deterministic 220-star field plus a founder welcome.

## Explicit boundary

The knowledge standard improves how the model uses its existing knowledge; it does not train the model or guarantee perfect factual accuracy. The current implementation is not a universal curated knowledge base and does not yet provide a general vector-search/RAG corpus across all subjects. Current factual information still depends on the live-research path and its provider credentials. Never describe an unconfigured or failed search as completed research.

## Next engineering layers

1. Add source-backed retrieval over a curated, versioned knowledge library, with provenance and update timestamps.
2. Add document ingestion with per-user ownership, extraction limits, source metadata and retrieval scoped to the user's workspace.
3. Add domain evaluation sets for factuality, reasoning, multilingual quality, code correctness, research citations and image-prompt adherence.
4. Add regression tests for tool routing, privacy boundaries, refusal behavior, stale-information handling and context isolation.
5. Keep Student Mode on its own prompt and release track. Core Assistant changes must not alter its learning routes, prompts, UI or dependencies.

## Release gate

No production merge or public preview announcement is implied by this document. A feature is complete only after tests pass, the preview build is ready, and the relevant user-facing flow is verified. Provider-dependent generation remains unverified until a real authorized provider call succeeds.
