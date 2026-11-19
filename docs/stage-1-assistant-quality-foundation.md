# Stage 1 — Core Assistant quality foundation

Status: planning and evaluation baseline. This document does not claim that the listed capabilities or targets are already implemented.

## Objective

Make Aahana Assistant the product's strongest and most dependable experience before expanding the surrounding engines. Improve answer quality through measurable evaluation, not prompt changes based on anecdotes.

## Scope

- Reasoning: multi-step problems, explicit assumptions, calculations, trade-offs and clear conclusions.
- Research: recognize when information may be stale, retrieve relevant sources when research is requested, distinguish evidence from inference, and cite claims.
- Truthfulness: say when evidence is missing; never invent browsing, tool execution, tests, files or integrations.
- Conversation: preserve relevant context, handle interruptions and follow-ups, and avoid repeating questions already answered.
- Multilingual: answer in the user's language and script; handle mixed-language messages without unnecessary switching.
- Reliability: predictable validation, useful errors, bounded timeouts and graceful recovery.
- Safety and privacy: protect account boundaries and private conversation data; treat retrieved web content as untrusted input.

## Evaluation set

Build a versioned set of at least 100 synthetic, non-sensitive prompts. Include at least 10 cases in each category:

1. Multi-step reasoning and planning.
2. Factual answers with uncertainty and calibrated confidence.
3. Current-information and research requests.
4. Source quality, citation relevance and evidence traceability.
5. Kannada, Hindi, English and mixed-language conversations.
6. Long-context follow-ups and instruction retention.
7. Coding explanations and debugging reasoning.
8. Ambiguous requests and clarification judgment.
9. Safety, privacy and prompt-injection resistance.
10. Error handling, interrupted streams and recovery.

Keep fixtures synthetic. Do not copy real users' private conversations into the benchmark without explicit, informed permission.

## Scoring rubric

Score each response from 1–5 on:
- Correctness and evidence.
- Completeness and relevance.
- Reasoning quality.
- Clarity and language match.
- Honesty about uncertainty and capability.

Record critical failures separately: fabricated sources, unsupported claims of tool use, privacy boundary violations, unsafe instructions, or lost user data. A critical failure cannot be hidden by a high average score.

## Release gates

Before a Stage 1 change is considered ready:

- Run the complete automated test suite and production build.
- Add regression tests for every fixed defect.
- Compare the candidate against the same versioned evaluation set and record the baseline and candidate scores.
- Review failures by category; do not ship a regression in authentication, conversation persistence, or privacy.
- Verify signed-in Preview behavior, conversation history, and Student Mode isolation.
- Keep Production, paid-provider activation, secrets, database migrations and destructive operations behind explicit owner approval.

Initial quality targets are proposed, not achieved: at least 90% of benchmark cases score 4/5 or better; zero critical safety/privacy failures; no regression in existing auth/history tests. Revisit targets after the first measured baseline.

## First implementation sequence

1. Map the current chat request, provider, system-instruction, research and persistence paths.
2. Identify existing tests and gaps; do not duplicate coverage blindly.
3. Add the synthetic evaluation fixtures and a repeatable scoring report.
4. Fix the highest-impact verified weaknesses one at a time.
5. Re-run tests, build and the same evaluation set for every candidate.

## Explicit non-goals for this stage

- No model/provider switch or paid inference activation.
- No Production deployment or environment-variable changes.
- No changes to Student Mode.
- No claim that Aahana outperforms another assistant until a reproducible comparison supports it.
