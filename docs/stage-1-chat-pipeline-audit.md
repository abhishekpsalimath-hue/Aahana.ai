# Stage 1 — Chat pipeline audit

Audit target: `main` at `2689802b2ca444c3667a9a155fdeaf40c0df6f3f` (19 Nov 2026).

This is a source inspection, not a live runtime test. No user conversations, production data, credentials or provider calls were used.

## Request lifecycle observed

1. Create the server-side Supabase client and authenticate the request.
2. Require `AAHANA_AI_ENABLED=true`; select Groq by default or the configured Vercel AI Gateway provider.
3. Resolve provider credentials and model from server-side environment.
4. Parse and validate the message, optional image data URL, mode, conversation ID and project ID.
5. Verify that any requested project belongs to the authenticated user and is not archived.
6. Verify conversation ownership or create a new conversation.
7. Persist the user's message.
8. Load the latest 20 messages for that user/conversation and bound context to 24,000 characters.
9. Construct the global system prompt; optionally add account-scoped memory when the user's memory setting is enabled.
10. Detect freshness/research intent. When requested, query Tavily, filter and rank HTTPS sources, and fail closed if no usable sources are returned.
11. Call the selected provider with a 45-second timeout. Ordinary answers stream; research answers are buffered.
12. For research, normalize citations against the exact retrieved URLs, require at least one verified citation, persist the answer, and return it.
13. For ordinary answers, parse provider SSE deltas, stream text to the client, and persist the complete response after normal completion.

## Confirmed implementation facts

- Authentication and per-user ownership checks occur before conversation content is loaded.
- Memory retrieval is opt-in and filtered by authenticated user ID.
- Research results are treated as untrusted data in the system prompt.
- Research is fail-closed when usable sources are unavailable.
- Research citation links are constrained to the URLs retrieved for that request.
- Conversation history is bounded by message count and character count.
- The ordinary streaming path persists the final accumulated reply after normal stream completion.

## Risks and test gaps to address

### P0 — partial response persistence on cancellation

The ordinary stream's `cancel()` currently cancels the upstream reader but does not persist `fullReply`. If a user stops generation or a client disconnects, already delivered text may not be saved. PR #24 proposes a cancellation persistence path; it needs targeted tests for abort, duplicate-save races and partial-content integrity before merge.

### P1 — persistence errors are not reflected to the client

The ordinary completion path logs an RPC save error but still closes the stream as if the response completed normally. The research path similarly logs a failed save and returns the answer. Define an explicit persistence-failure contract and test it without exposing database details to users.

### P1 — cancellation and request lifecycle are not yet proven

The upstream provider fetch uses its own timeout, but the inspected code does not explicitly pass the incoming request's abort signal to that fetch. Test browser stop, network disconnect, provider timeout and server shutdown to verify upstream work is cancelled and resources are released.

### P1 — chat route lacks dedicated tests

At the audited commit, the repository has four test files, all for build-workflow modules. There are no focused tests for chat authentication, ownership, memory isolation, research fail-closed behavior, citation validation, stream parsing or persistence.

### P2 — ignored conversation update errors

Conversation timestamp updates are awaited but their returned errors are not checked in the inspected paths. Add observability and a defined retry/recovery policy where appropriate.

## Next test sequence

1. Authentication missing/invalid; AI disabled; provider credentials missing.
2. Malformed JSON, empty/oversized prompt, invalid image payload and unsupported mode.
3. Cross-account project and conversation access attempts.
4. Memory disabled, memory lookup failure and account isolation.
5. Research intent detection, missing Tavily key, provider failure, empty sources and citation mismatch.
6. SSE parsing across chunk boundaries, malformed frames, empty response and provider error.
7. Normal completion, user abort, disconnect, partial persistence, duplicate-save race and persistence failure.
8. Regression verification for signed-in workspace, conversation history and Student Mode.

## Scope guardrails

- No provider/model changes or paid inference activation.
- No Production deployment, secrets or environment-variable changes.
- No database schema changes or real user-data access.
- Student Mode remains untouched.
- Findings above are source-level observations until covered by automated tests and Preview verification.
