# Aahana Executive AI System

## Goal
Build an execution-oriented executive team that improves decision quality, speed, accountability, and operational accuracy. These are specialised AI workflows, not four cosmetic chat personas.

## Executive roles
- **CEO**: Sets strategic priorities, resolves conflicts, approves high-impact decisions, and coordinates the executive team. Produces decision briefs with options, trade-offs, owners, and success measures.
- **CTO**: Owns architecture, engineering plans, reliability, security, data governance, technical debt, and release readiness. Cannot deploy or change production without an authorised approval.
- **COO**: Owns operating procedures, task execution, process quality, service levels, risk registers, dependencies, and weekly operating reviews.
- **CMO**: Owns positioning, customer research, GTM, content, acquisition experiments, funnel measurement, retention insights, and campaign reporting. Must not invent traction, testimonials, partnerships, or campaign results.

## Shared execution model
1. User submits a goal or task.
2. CEO coordinator classifies it, identifies the accountable executive, and splits cross-functional work into bounded tasks.
3. Specialist prepares a plan with assumptions, evidence, risks, dependencies, estimated effort, and measurable acceptance criteria.
4. A task board records status: proposed, approved, in_progress, blocked, review, completed, rejected.
5. Specialists may collaborate through structured task briefs; they do not silently overwrite one another's decisions.
6. The coordinator presents one consolidated update and requests approval for consequential actions.
7. Completion requires evidence (artifact, test result, source, or explicit user confirmation), not an agent's assertion.

## Accuracy and safety requirements
- Keep all company workspace data tenant-scoped to the authenticated user and authorised project.
- Enforce role-based tool permissions on the server; never rely on UI-only restrictions.
- Separate read, draft, and execute permissions.
- Require explicit approval before external communications, spending, publishing, account changes, production deploys, destructive actions, or legal/financial commitments.
- Record task owner, status, input references, output, approvals, timestamps, and execution evidence.
- Label facts, assumptions, recommendations, and unknowns separately.
- Never fabricate market research, customer feedback, revenue, metrics, source citations, or completed actions.
- Add idempotency and audit logging before enabling external side effects.
- Do not expose one user's private memory, files, or project context to another user.

## Suggested task record
- id, user_id, project_id
- title, objective, executive_role
- status, priority, due_at
- input_summary, assumptions, risks, dependencies
- proposed_actions, approval_required, approved_by, approved_at
- output_summary, evidence_refs, created_at, updated_at, completed_at

## Suggested interface
- Executive workspace with four role cards and one CEO command centre.
- Task inbox with owner, priority, status, due date, and blockers.
- Decision log with options, recommendation, rationale, and approval.
- Team activity feed showing only verified events.
- Clear distinction between a draft prepared by an executive and an action actually executed.

## Delivery sequence
### Phase 1 — Safe foundation
- Add executive role selection and server-side role prompts.
- Add shared task/decision data model with tenant-scoped row-level security.
- Add task creation, assignment, status updates, and audit events.
- Keep all external actions in draft-only mode.

### Phase 2 — Cross-executive coordination
- CEO coordinator routes work to CMO, CTO, and COO.
- Specialists return structured plans and evidence.
- CEO consolidates conflicting recommendations and asks for decisions when required.

### Phase 3 — Approved execution
- Connect selected tools one at a time.
- Add explicit approval gates, idempotency, audit logs, and failure recovery.
- Start with low-risk internal actions; expand only after verification.

### Phase 4 — Measurement and optimisation
- Track cycle time, first-pass acceptance, task completion, blocked time, citation/evidence coverage, and user corrections.
- Evaluate quality before optimising for speed. Do not optimise speed by bypassing verification.

## First release acceptance criteria
- A user can select CEO, CTO, COO, or CMO for a conversation.
- Role prompts change responsibilities and output format, not access boundaries.
- Tasks are private to the authenticated user and selected project.
- The system can create and update tasks with audit events.
- No external action is executed without explicit approval.
- Unit/integration tests cover ownership checks, role validation, approval enforcement, and status transitions.
- Existing ordinary Aahana chat remains unchanged.
