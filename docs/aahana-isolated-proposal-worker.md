# Aahana isolated proposal worker — Phase 2

This is a manually triggered, report-and-propose worker. It is intentionally not scheduled yet.

## What it does

1. Checks out the current `main` commit in a fresh GitHub-hosted runner.
2. Reads only bounded source files under `src/app/experience-lab/`, `src/lib/build/`, and the approved `src/app/assistant-workspace.jsx` file.
3. Sends that source context and one focused task to the configured Groq model.
4. Accepts only exact search/replace patches for up to three existing allowlisted files.
5. Applies the patch, then runs `npm run build` (which includes `npm test`).
6. Only after successful verification, mints a repository-scoped GitHub App token with Contents: write and Pull requests: write, then opens a draft PR.
7. Never merges or deploys.

## Required repository Actions secrets

- `GROQ_API_KEY`
- `AAHANA_GITHUB_APP_ID`
- `AAHANA_GITHUB_PRIVATE_KEY`

The GitHub App must be installed on this repository and have Contents: read/write and Pull requests: read/write permissions. The workflow mints a short-lived token scoped to this single repository and only in the final PR-creation step. It does not require or use the Supabase installation ID.

## Hard boundaries

- No Supabase, production database, customer conversations, user uploads, Vercel token, or production credentials.
- No authentication, Student Mode, billing, database, migration, dependency, lockfile, deployment workflow, or self-build security-policy changes.
- Maximum three files, eight exact patches per file, 180 KB final proposal.
- The worker can create draft PRs only after tests and build pass. It cannot merge, close, or deploy.
- Every draft PR requires owner review and manual acceptance.

## Rollout

First configure the three repository Actions secrets and manually dispatch one narrowly scoped task. Inspect the resulting draft PR and workflow logs. Only after a successful end-to-end trial should a daily schedule be considered.
