# Aahana Flow + Aahana Shield — Product Foundation

Status: approved product direction; implementation proposal only. This document does not authorize production deployment, changes to existing authentication, Supabase data, billing, or Student Mode.

## Product vision

Aahana AI expands from a personal AI workspace into a platform that helps people think, create, automate business operations, and protect digital assets.

The existing product remains the foundation:
- Core AI Assistant
- Creative Intelligence
- Autonomous Aahana Agent
- Existing Assistance and Student experiences remain intact. Student Mode is out of scope for these changes.

Two new business products are introduced inside the Aahana ecosystem:

## Aahana Flow — Business Automation

Purpose: no-code/low-code business workflow automation with a natural-language-first experience. Users should describe an outcome; Aahana helps design, explain, validate, and operate a workflow without requiring users to understand nodes or APIs.

Initial capability areas:
- Visual workflow canvas with explicit trigger, action, condition, and approval steps.
- Natural-language workflow drafting and editable workflow previews.
- Scheduled and event-driven workflows.
- Business document processing for user-provided PDFs, spreadsheets, and invoices.
- Integrations through explicit, scoped OAuth/API connections; never collect provider passwords.
- Run history, per-step logs, retries, pause/resume, failure alerts, and usage visibility.
- Human approval gates for external messages, financial actions, destructive changes, and sensitive data operations.

Initial examples:
- Daily sales and expense summaries.
- New enquiry capture and assignment.
- Invoice extraction and review.
- Customer follow-up reminders.
- Weekly attendance and operations reports.
- Email-to-order intake with a human approval checkpoint.

## Aahana Shield — Cybersecurity & Data Protection

Purpose: practical defensive security and data governance for individuals and businesses. This is not a promise of complete protection and is not an offensive security tool.

Initial capability areas:
- Security posture checklist and guided hardening.
- Authorized website/application vulnerability checks with explicit asset ownership/authorization.
- Account and access review, MFA recommendations, and least-privilege guidance.
- Encryption and key-management design for stored and transmitted business data.
- Backup status, recovery readiness, and retention controls.
- Security event summaries, anomaly alerts, and audit trails.
- Data inventory, classification, access history, and incident-response guidance.

Safety boundaries:
- No stealth, persistence, credential theft, exploitation of third-party targets, or unauthorized scanning.
- Active tests require clear authorization, scope, rate limits, and safe checks.
- Do not claim that a scan proves a system is secure.
- Do not store secrets in client-side code, logs, prompts, or workflow definitions.
- Security-critical controls must be enforced server-side and independently tested.

## Account and workspace architecture

Product experiences may have separate entry points and dedicated workspaces, but should not create duplicate, disconnected identity systems by default.

Proposed model:
- Preserve existing Aahana personal sign-in unchanged.
- Introduce a business organization/workspace identity layer only after reviewing the existing auth model.
- Business members have organization-scoped roles and permissions.
- Aahana Shield has step-up authentication for sensitive administrative operations.
- MFA, session management, audit events, and recovery controls are mandatory before production.
- Tenant isolation must be enforced server-side; UI separation alone is not security.
- Separate product workspaces do not imply separate databases or separate logins until architecture and migration risks are evaluated.
- No changes to existing users, auth settings, Supabase schema, or production data as part of this foundation.

## Commercial proposal — not yet launch-approved

Reference prices supplied by the founder:
- n8n Pro: ₹1,555 + GST/month.
- Data protection comparison: ₹1,666 + GST/month (specific competitor/product still to be verified).

Proposed Aahana pricing for evaluation:
- Flow Starter: ₹799/month + applicable taxes.
- Flow Pro: ₹1,299/month + applicable taxes.
- Shield Starter: ₹999/month + applicable taxes.
- Shield Pro: ₹1,499/month + applicable taxes.
- Flow + Shield bundle: ₹1,999/month + applicable taxes.
- Three-day trial concept, with explicit consent before any paid conversion.

Prices, plan limits, taxes, payment provider, and trial conversion rules must be validated before billing implementation or public claims. Never activate paid billing without explicit customer consent.

## Delivery sequence

1. Architecture and threat-model review; inspect existing routes, auth, Supabase policies, and server boundaries without changing them.
2. Build isolated Flow and Shield experience prototypes using mock/demo data only.
3. Implement Flow workflow model and safe execution sandbox; add integrations only with scoped consent.
4. Implement Shield defensive checks and data-governance controls; independently test security claims.
5. Add organization membership, MFA/step-up authentication, tenant isolation, audit logs, and recovery only after a reviewed migration plan.
6. Add billing and the 3-day trial only after pricing, taxes, limits, cancellation, and consent flows are approved.
7. Run automated tests, security review, accessibility and mobile QA, then obtain founder approval before merge/deployment.

## Non-negotiable release boundaries

- No merge or production deployment without explicit founder approval.
- No changes to existing user data, existing auth, Supabase settings, secrets, billing, provider credentials, migrations, deployment workflows, or Student Mode without separate explicit approval.
- Keep all new work isolated behind a feature branch and draft pull request.
- Do not represent prototypes, mock data, or untested checks as working production security or automation.


## Implementation progress — isolated development branch

The first workspace prototype batch now includes authenticated `/flow` and `/shield` routes, business navigation links, three sample Flow templates, a local-only dry-run preview, and a Shield checklist with control-specific evidence examples. Flow has a pure workflow-definition validator with a fixed operation allowlist, unique step IDs, a 30-step cap, trigger/approval ordering rules, mandatory human approval for outbound/notification operations, and a dry-run plan that explicitly produces no external side effects. Nine Node tests cover valid and invalid definitions, unsafe operations, duplicate IDs, approval requirements, size limits, and dry-run behavior. Shield starts with zero controls marked reviewed and does not claim to scan or verify live infrastructure. These prototypes do not yet persist data to an account, connect providers, execute workflows, or perform live security checks. Test execution and fresh preview QA remain pending because Vercel returned a build-rate-limit response for the latest branch commit.


## Current prototype scope (branch snapshot)

The Flow canvas now supports adding and removing bounded custom action steps from a fixed safe operation menu, switching among three starter templates, and generating a validated local dry-run plan. Outbound/notification-style actions are held at the final human approval gate. The natural-language field currently captures a request description only; it is not yet an AI workflow planner. The Shield checklist provides evidence examples tailored to each control, starts with no controls marked reviewed, and keeps review state only in the current browser session. These limitations are intentionally visible rather than simulated as connected production capabilities.
