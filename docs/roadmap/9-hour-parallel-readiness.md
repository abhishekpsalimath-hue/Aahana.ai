# Aahana AI — 9-hour parallel readiness roadmap

**Purpose:** Use the available nine-hour engineering window to make Stages 2–5 independently developable, testable and integration-ready while protecting Core Assistant reliability and Student Mode.

**Operating rule:** Parallelize discovery, contracts, tests and isolated implementation. Do not parallelize conflicting writes to shared runtime files. No merge, Production deployment, paid provider activation, shared/Production migration or destructive operation without founder approval.

## Workstream map

| Workstream | Existing work to inspect first | New tracking |
|---|---|---|
| Core / Stage 1 | PR #29 quality gates; PR #30 cancellation; PR #24 stop-generation overlap | Existing PRs |
| Stage C autonomy | PR #31 worker; PR #26 sandbox; PR #7/#5 dependency chain | Issue #32 |
| Stage 2 Build | PR #26 workspace; existing chat/research interfaces | Issue #33 |
| Stage 3 Create & Motion | PR #15, #17, #25, #27 media work | Issue #34 |
| Stage 4 Voice | PR #12 and #13 voice preferences/runtime; PR #14 learning dependency | Issue #35 |
| Stage 5 Agent | PR #5, #7, #31 task/runtime foundations | Issue #36 |

Existing PRs are candidate foundations, not approved integrations. Re-check their current head SHAs, checks, merge bases and changed-file overlap before depending on them.

## Nine-hour execution plan

### Hour 0–1 — Baseline and dependency map
- Snapshot open PRs, head/base SHAs, check-runs, changed paths and dependency chains.
- Identify shared-file conflicts across Core, Build, media and Voice.
- Freeze Student Mode files from unrelated changes.
- Record provider and environment prerequisites without exposing secret values.
- Deliverable: dependency map and risk register.

### Hour 1–2 — Shared contracts
- Define common task/job lifecycle: queued, running, checkpointed, awaiting approval, completed, failed, cancelled.
- Define common artifact envelope: immutable ID, owner/scope, source revision, output references, logs, test evidence, timestamps and retention.
- Define provider adapter interface, cancellation contract, timeouts, error taxonomy and cost metadata.
- Define server-side authorization and audit-event contract.
- Deliverable: versioned interface specifications; no shared runtime rewrite.

### Hour 2–3 — Stage 2 Build
- Map existing workspace APIs and UI to the new Build task contract.
- Specify safe file access, patch review, preview/test evidence and export approval.
- Separate user workspace execution from Aahana self-repository execution.
- Add acceptance and adversarial test matrix for path traversal, symlinks, malicious manifests, secrets and network egress.
- Deliverable: Build implementation plan and testable contract.

### Hour 3–4 — Stage 3 Create & Motion
- Inventory image/video PRs and provider adapters; identify duplicate endpoints and shared components.
- Define unified async creative-job and artifact contracts with image and video capability-specific extensions.
- Specify upload/reference consent, asset privacy, cancellation, retries, provider errors and cost controls.
- Define quality/latency/cost evaluation cases.
- Deliverable: Create/Motion integration map and provider-neutral interface.

### Hour 4–5 — Stage 4 Voice
- Inventory voice runtime, language preference and auto-read behaviour.
- Define session state machine, audio transport, transcript and interruption semantics.
- Specify permission indicators, no always-on capture, retention/deletion and text fallback.
- Add tests for barge-in, duplicate turns, disconnect/reconnect, permission denial and cancellation.
- Deliverable: Voice contract and regression plan.

### Hour 5–6 — Stage 5 Agent
- Define planner, tool registry, least-privilege permissions, checkpoints and evidence-backed reports.
- Separate read-only, reversible write and high-impact actions.
- Add confirmation gates for external messages, financial actions, destructive operations, sensitive data and Production changes.
- Specify prompt-injection resistance and idempotent retries.
- Deliverable: Agent permission matrix and execution contract.

### Hour 6–7 — Stage C autonomous coding foundation
- Implement policy-first task schema and path/diff validation in an isolated branch.
- Define disposable sandbox adapter interface and immutable artifact capture.
- Add tests for oversized output, timeout, cancellation, cleanup, secret detection and out-of-scope diffs.
- Keep GitHub write credentials outside sandbox and model context.
- Deliverable: independently testable policy layer; no paid sandbox provisioning.

### Hour 7–8 — Cross-stage integration review
- Check contracts for compatibility and identify shared components that can be safely reused.
- Verify Stage 1 cancellation semantics apply to Build, Voice, media and Agent jobs.
- Verify common artifact and audit schemas meet all stages without broad permission grants.
- Resolve dependency order; prepare draft PR plans, not merges.
- Deliverable: integration matrix and prioritized blockers.

### Hour 8–9 — Evidence and founder handoff
- Run available automated tests and CI on exact SHAs for touched branches.
- Record what passed, failed, was not run and remains provider-/environment-dependent.
- Produce a release gate checklist and next execution queue.
- Deliverable: evidence-backed nine-hour report with links and explicit decisions needed.

## Cross-stage architecture rules
1. One Aahana Core; specialist capabilities are engines, not separate disconnected assistants.
2. Shared contracts are versioned; provider-specific implementations stay behind adapters.
3. Every long-running job supports status, cancellation, bounded retries and auditable artifacts.
4. User workspace and autonomous repository sandbox remain separate trust domains.
5. No credentials in browser bundles, prompts, task output or sandbox environments unless narrowly scoped and approved.
6. Student Mode remains protected from unrelated changes.
7. Basic plan ordinary text conversation remains unlimited; premium resource controls must not impose a daily text-chat cap.
8. No fabricated provider connectivity, test results, completed work or delivery guarantees.

## Release gates
- CI and relevant tests pass on the exact proposed commit SHA.
- Security, privacy, permissions and abuse cases are tested.
- Preview/runtime behaviour is verified where applicable.
- Data migrations are tested in an isolated database first.
- Rollback and observability are documented.
- Founder explicitly approves merge, Production deployment, paid services, shared/Production migrations or high-impact actions.

## Status vocabulary
Use **scoped**, **in progress**, **implemented**, **tests passed**, **Preview verified**, and **Production verified** precisely. A roadmap or issue is not an implementation. A passing unit test is not proof of live provider connectivity. A completed worker task is not proof of independently verified code development.
