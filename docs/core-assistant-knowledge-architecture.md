# Aahana AI — Core Assistant knowledge architecture

## What is active in this branch

- The Core Assistant uses the configured Groq model and a dedicated knowledge standard for non-Student modes.
- The knowledge standard encourages first-principles explanations, cross-domain reasoning, explicit assumptions, consistency checks, and honest uncertainty.
- Existing chat infrastructure keeps a bounded recent conversation history and supports private, account-scoped memory only when the user enables it.
- The chat route has an opt-in live-research path for freshness-sensitive requests. It uses Tavily only when a server key is configured and validates citations against the URLs retrieved for that request.
- The image endpoint now optionally asks the configured Groq model to refine the image prompt before calling FLUX.1-schnell at its maximum supported 8 inference steps. Higher steps can improve quality but take longer and consume more inference usage. If refinement is unavailable, times out, or returns unusable output, the original prompt is used.
- The public introduction is isolated from the signed-in workspace and contains a deterministic 220-star field plus a founder welcome.

## Explicit boundary

The knowledge standard improves how the model uses its existing knowledge; it does not train the model or guarantee perfect factual accuracy. Likewise, prompt refinement and 8-step image inference can improve prompt adherence and image quality, but generative image output is stochastic and cannot be guaranteed to match every detail 100%. The current implementation is not a universal curated knowledge base and does not yet provide a general vector-search/RAG corpus across all subjects. Current factual information still depends on the live-research path and its provider credentials. Never describe an unconfigured or failed search as completed research.

## Next engineering layers

1. Add source-backed retrieval over a curated, versioned knowledge library, with provenance and update timestamps.
2. Add document ingestion with per-user ownership, extraction limits, source metadata and retrieval scoped to the user's workspace.
3. Add domain evaluation sets for factuality, reasoning, multilingual quality, code correctness, research citations and image-prompt adherence; add reference-image guidance and an opt-in output-critique/refinement loop after its usage and cost are measured.
4. Add regression tests for tool routing, privacy boundaries, refusal behavior, stale-information handling and context isolation.
5. Keep Student Mode on its own prompt and release track. Core Assistant changes must not alter its learning routes, prompts, UI or dependencies.

## Release gate

No production merge or public preview announcement is implied by this document. A feature is complete only after tests pass, the preview build is ready, and the relevant user-facing flow is verified. Provider-dependent generation remains unverified until a real authorized provider call succeeds.


## Live website discovery and research

- Student Mode retains its pre-existing search-only behavior; website crawling and page extraction are Core Assistant features only.\n- Search requests retrieve ranked web results; the assistant then extracts up to five selected pages when extraction is available, so answers can use page content rather than snippets alone.
- Requests that include an HTTPS URL and ask to inspect, explore, audit, or deep-dive a website use bounded same-site crawling. Current limits are depth 3, breadth 10, and up to 30 returned pages. External domains are excluded.
- Retrieved material is passed to the model as untrusted evidence. The assistant must not follow instructions found in webpages, must not invent citations, and must not claim that every page on a large site was inspected when only a bounded sample was returned.
- Citation links are restricted to HTTPS URLs retrieved for that specific request. If live retrieval fails or the provider key is missing, the route fails closed instead of presenting stale model knowledge as verified research.
- Search, extraction, and crawling are external network operations. Response time depends on provider latency, site size, and extraction complexity; sub-second completion cannot be guaranteed. The current implementation is bounded for responsiveness, not a promise to crawl every page of every site.
- Website crawling requires TAVILY_API_KEY to be configured in the deployment environment. No credentials are embedded in source code.


### Research latency budget

- The Core Assistant route has a 60-second server execution ceiling. Website crawl is bounded to a 20-second provider timeout (22-second client timeout); search and extraction have shorter individual timeouts, and the research model call has a 32-second timeout.
- The crawl is limited to depth 3, breadth 10, and at most 30 returned pages. These limits trade exhaustive coverage for a bounded response time; large sites may require multiple targeted research questions.
- These are upper bounds, not a sub-second speed guarantee. Network, crawler, and model latency vary.
