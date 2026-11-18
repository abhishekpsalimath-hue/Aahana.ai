# Stage 2 — Image workflows

## Scope

- Existing prompt-to-image generation remains available only when image safety is explicitly enabled.
- Uploaded-image editing uses Cloudflare Workers AI `black-forest-labs/flux-3-image-klein` with the source image as a reference and preservation-focused edit instructions.
- Image enhancement uses Topaz `gigapixel-high-fidelity-3`, requesting a 3,840-pixel output width and preserving the source aspect ratio.
- The source upload is never overwritten. The API returns a separate processed copy as a data URL for preview/download.
- PNG, JPEG and WebP are accepted by the workspace; WebP is converted to JPEG in the browser before processing.
- Upload limit is 2 MB. Processed image response limit is 15 MB.

## Safety

Both image endpoints require `AAHANA_IMAGE_SAFETY_ENABLED=true`. The uploaded-image workflow additionally requires `AAHANA_IMAGE_WORKFLOWS_ENABLED=true`.

Before processing, the API:
1. Checks text prompts with Cloudflare Llama Guard 3.
2. Checks the source image with a vision model.
3. Checks the resulting image again before returning it to the browser.
4. Fails closed if a safety model is unavailable or cannot return a clear verdict.

These model-based checks are defence in depth, not a guarantee that every unsafe image will be detected. Keep human reporting/review available before public release.

## Billing and activation

The workflow is intentionally disabled by default. No Vercel environment variables were changed and no image, editing, enhancement, or moderation inference was run during implementation.

Cloudflare's Topaz High Fidelity 3 is a usage-priced third-party model. FLUX 3 Image Klein is also usage-priced. Enable the flags only after reviewing the provider account's current pricing, quotas, and intended billing. Do not enable paid workflows merely to make a preview appear active.

## Stable address and release

The verified production project domain is `https://aahana-ai.vercel.app`. Stage 2 preview builds must not replace the Production deployment. Future releases should continue using this same domain after explicit release approval.

## Known limits

- Generative editing cannot guarantee pixel-perfect preservation or 100% prompt fidelity.
- The 4K workflow requests 3,840 pixels of output width; actual output and detail quality remain subject to provider behavior and source quality.
- The current workflow returns a processed copy to the browser; it does not yet create a permanent cloud image library or long-lived share link for each image.
- Authenticated end-to-end provider execution remains pending until the feature flags and billing are explicitly approved.
