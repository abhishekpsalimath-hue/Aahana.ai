# Aahana private image upscaling worker

This is an isolated Cloudflare Worker prototype. It accepts raw PNG, JPEG, or WebP bytes from Aahana's authenticated server, uses the Cloudflare Images binding with AI upscaling, and returns a PNG response.

## Privacy and safety

- The Worker does not accept image URLs and never fetches a public source URL.
- Image bytes are processed directly through the Images binding.
- Requests require a server-to-server bearer secret.
- The response is marked `Cache-Control: no-store`.
- The Worker rejects unsupported formats, mismatched file signatures, empty images, and inputs over 20 MB.
- No image is persisted by this Worker.
- Do not expose the shared secret to browser code.

## Cloudflare setup (not performed)

1. Create a separate Worker using this directory as its source.
2. Bind Cloudflare Images as `IMAGES` (already declared in `wrangler.jsonc`).
3. Set `AAHANA_UPSCALE_SHARED_SECRET` as a Worker secret.
4. Configure the same value as a server-only Vercel environment variable before connecting Aahana's API route.
5. Review Images transformation quota and usage before enabling the feature.

The Cloudflare Images Free plan currently includes 5,000 unique transformations per month. Exceeding the free limit causes new unique transformations to fail rather than incur overage charges. The feature must remain opt-in until the Worker is separately deployed and tested.

## Local tests

Run from the repository root:

```sh
node --test workers/image-upscale/index.test.mjs
```

This worker is not deployed and is not connected to Aahana's production app by this change.
