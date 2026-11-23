# Aahana isolated work — staged rollout

## Phase 1: daily evidence report

The `Aahana isolated daily engineering report` workflow runs on a daily schedule (19:00 IST target), on demand, and when its own workflow/script changes in a pull request.

It checks out repository source, installs dependencies, runs `npm run build` (which includes the Node test suite), and creates a Markdown report. When the `GROQ_API_KEY` Actions secret is configured, Aahana's Groq model reviews only the bounded commit metadata and test/build log excerpt supplied to it.

The report is published to the GitHub Actions run summary and retained as a 30-day artifact. It does not commit reports to the product repository.

## Explicit safety boundary

- GitHub workflow permission is `contents: read`.
- No Supabase URL/key, service-role credential, Vercel token, production database, customer conversation, or user file is passed to the workflow.
- The job does not modify files, create branches or pull requests, merge, deploy, or access Student Mode.
- The workflow is an engineering observer, not yet an autonomous code-writing worker.

## Enable AI review

In the repository's GitHub Settings → Secrets and variables → Actions, add an Actions secret named `GROQ_API_KEY` containing the existing Groq API key. Do not paste the key into chat, source code, or a commit.

Without this secret, the workflow still runs checks and creates a deterministic report, but the AI review section states that it is not configured.

## Phase 2: proposal worker (not enabled in this phase)

The next phase will add a separate, manually enabled worker that can propose changes only inside the already-reviewed self-build allowlist, run tests/build in an isolated runner, and open draft pull requests only after validation. It must not receive production credentials or write to main. That worker will remain disabled until its secret scope and review gates are verified.
