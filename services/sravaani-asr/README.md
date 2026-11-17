# Aahana private SraVaani ASR service (opt-in scaffold)

This is a self-hosted wrapper around the **official** SraVaani 1.0 Python
interface. It is not an official ARTPARK HTTP API. The model's documented
quickstart loads `ARTPARK-IISc/SraVaani-1.0` with Transformers and calls
`model.transcribe(local_wav_path, return_hypotheses=True)`; this wrapper
exposes that operation behind a private, authenticated endpoint.

## Important: not production-ready yet

- The Hugging Face model is gated. Accept its terms and use a read-only token.
- The model uses `trust_remote_code=True`. Review and audit the exact pinned
  revision before enabling it. Startup refuses to proceed without an immutable
  commit SHA and the explicit `ALLOW_AUDITED_REMOTE_CODE=true` acknowledgement.
  That acknowledgement is an operator assertion, not an automated security
  audit. Do not enable it until the source has been reviewed.
- No model revision is selected in this repository. Never substitute `main`.
- No GPU is provisioned and no live model test has been performed.
- This service accepts WAV only, up to 15 MB and 90 seconds. Audio is held in
  memory and a temporary file during inference, then the file is deleted.
- The endpoint requires a bearer token. Put it behind a private network or
  authenticated gateway; do not expose the model service publicly.
- Add ingress rate limits, TLS, monitoring, request timeouts, and per-user
  consent before any real deployment. The in-process lock serializes inference
  in a single worker; do not start multiple workers on one GPU without sizing it.
- The health endpoint intentionally exposes no model revision or secrets.

## Local setup

1. Use a dedicated Linux environment with a compatible PyTorch/CUDA build.
2. Install dependencies from `requirements.txt`.
3. Copy `.env.example` to a secret-managed environment; never commit credentials.
4. Accept the gated model conditions and obtain an immutable model commit SHA.
5. Review and pin the remote Python source before setting the explicit audit
   acknowledgement.
6. Start with one worker:

```bash
uvicorn app:app --host 127.0.0.1 --port 8010 --workers 1
```

## Internal endpoint contract

`POST /v1/audio/transcriptions`

- Header: `Authorization: Bearer <SRAVAANI_API_TOKEN>`
- Multipart field: `file` (WAV)
- Success: `{"text":"…","provider":"sravaani-1.0","audio_retained":false}`

`GET /health` returns a minimal readiness state.

This is an internal service contract authored for Aahana, not an upstream
SraVaani endpoint. It is not yet connected to the Next.js application or the
browser voice UI.

## Next verification gates

- Audit the exact remote code at the pinned Hugging Face revision.
- Run static checks and unit tests in a dedicated Python environment.
- Test Kannada, Hindi, Tamil, Telugu, Bengali, code-switching, noisy speech,
  accents, silence, malformed WAV, oversized audio, cancellation and
  concurrent requests using consented test recordings.
- Measure WER, latency, peak RAM/VRAM and per-session cost on actual hardware.
- Add an Aahana server-only provider adapter only after this endpoint is
  deployed privately and the service contract is independently tested.

Official model page: https://vaani.iisc.ac.in/models/sravaani
Official model card: https://huggingface.co/ARTPARK-IISc/SraVaani-1.0
Official inference example: https://huggingface.co/ARTPARK-IISc/SraVaani-1.0/blob/main/README.md
