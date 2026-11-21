# Aahana private image upscaling worker

This is an isolated Cloudflare Worker prototype. It accepts raw PNG, JPEG, or WebP bytes from Aahana's authenticated server, uses the Cloudflare Images binding with AI upscaling, and returns a PNG response.

## Privacy and safety

- The Worker does not accept image URLs and never fetches a public source URL.
- Image bytes are processed directly through the Images binding.
- Requests require a server-to-server bearer secret.
- The response is marked `Cache-Control: no-store`.
- The Worker rejects unsupported formats, mismatched file signatures, empty images, and inputs over 20 MB.
- Input streams are bounded before multipart parsing in the Aahana API route.
- No image is persisted by this Worker.
- Do not expose the shared secret to browser code.

## Cloudflare setup (not performed)

1. Create a separate Worker using this directory as its source.
2. Bind Cloudflare Images as `IMAGES` (already declared in `wrangler.jsonc`).
3. Set `AAHANA_UPSCALE_SHARED_SECRET` as a Worker secret.
4. Configure these server-only Vercel variables:
   - `AAHANA_UPSCALE_SHARED_SECRET` — same value as the Worker secret.
   - `AAHANA_IMAGE_UPSCALE_WORKER_URL` — the deployed HTTPS Worker endpoint.
   - `AAHANA_IMAGE_UPSCALE_ENABLED` — leave unset or `false` until the Worker is tested and explicitly approved for activation.
5. Review transformation quota and usage before enabling the feature.

## Pricing and limits

Cloudflare Images Free includes up to 5,000 unique transformations each month. After that, new unique transformations return an error and are not charged on the Free plan. The Paid plan charges $0.50 per 1,000 unique transformations beyond the included 5,000. Each unique source image plus transformation parameters counts as one transformation. Repeated requests for the same image and parameters in the same calendar month count only once.

The feature must remain opt-in until the Worker is separately deployed, tested, and approved. See the official [Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing/) and [Workers binding documentation](https://developers.cloudflare.com/images/optimization/binding/).

## Local tests

Run from the repository root:

```sh
node --test workers/image-upscale/index.test.mjs src/lib/creative/image-upscale.test.mjs
```

These tests mock the Cloudflare Images binding. They do not prove that a live Cloudflare account has the binding enabled or that an actual image transformation succeeds.

This Worker is not deployed and the Aahana feature flag remains off by default.
