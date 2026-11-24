# Controlled Aahana image benchmark

This runner makes at most **10 sequential image-generation requests** to Aahana's existing Cloudflare Workers AI provider. It uses only the ten fixed synthetic prompts in `scripts/run-image-benchmark.mjs`; it does not read user uploads, call the chat API, write to Supabase, or change production data.

## Run

1. Configure repository Actions secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` with the same restricted Cloudflare credentials already used by Aahana.
2. Optionally set the repository Actions variable `AAHANA_IMAGE_MODEL` to `flux-2-klein-4b` or `flux-2-dev`. If unset, the existing default FLUX.1 Schnell is used. The runner never silently falls back to a different model.
3. From GitHub Actions, manually run **Aahana controlled image benchmark** using this branch.

Cloudflare usage charges/quotas, if any, apply to these ten requests. The workflow does not estimate cost because the account's billing terms and credits are not available to the repository. Do not run it until the account owner has checked the Cloudflare AI usage/billing page.

Images and a metadata manifest are retained as a private workflow artifact for three days. The manifest contains model, case IDs, dimensions, MIME types, and latency; it never contains credentials or provider response bodies. Visual quality must be scored by a human using the existing five-dimension scorecard; generation success is not an accuracy score.
