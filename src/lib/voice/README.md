# Aahana speech runtime

The speech runtime separates speech-to-text (recognition) and text-to-speech
(synthesis) from the chat interface. A provider is supplied explicitly to
`createSpeechRuntime`; the runtime does not select vendors or read credentials.

## Provider contracts

Recognition providers implement:

- `id: string`
- `supportedLocales: string[]` (BCP 47 locale tags)
- `transcribe({ audio, locale, signal }): Promise<{ text, locale? }>`
- optional `isAvailable(): boolean`

Synthesis providers implement:

- `id: string`
- `supportedLocales: string[]` (BCP 47 locale tags)
- `synthesize({ text, locale, signal }): Promise<{ audio, mimeType?, locale? }>`
- optional `isAvailable(): boolean`

Recognition and synthesis can use different providers and have independent
locale coverage. Unsupported locales fail before provider invocation. Empty
transcripts/audio and unavailable providers fail with stable error codes.

## Request deadlines and cancellation

- SraVaani recognition and Maya synthesis requests have a 45-second upstream
  deadline by default, with a hard adapter configuration ceiling of 120 seconds.
- The caller's abort signal is combined with the provider deadline. A user
  cancellation remains distinct from a provider timeout.
- Provider deadline expiry returns the stable `PROVIDER_TIMEOUT` error code;
  the authenticated HTTP routes translate it to HTTP 504.
- These deadlines bound the outbound fetch. They do not prove that a remote
  inference process stopped after disconnect; the private service should also
  enforce its own request and GPU-worker limits.

## Security and activation

- No provider is configured by default.
- No API key, vendor SDK, paid endpoint, or audio upload is activated by this
  package.
- Production provider composition must happen server-side for secret-backed
  providers. Never expose provider API keys in browser bundles.
- Any provider activation must include explicit user approval, documented
  retention and training policies, regional data handling, cost controls,
  per-user consent, rate limits, and an opt-out.
- Do not claim a locale is supported until the selected provider advertises it
  and an end-to-end test verifies both recognition and synthesis.
- Keep transcript text visible and editable; spoken output must remain optional.

The browser SpeechRecognition and SpeechSynthesis APIs remain a local,
best-effort fallback and are not a substitute for provider-backed multilingual
coverage.

## Locale coverage reporting

Use `getSpeechLocaleSupport(capabilities, locale)` from `locale-support.mjs` to
report recognition and synthesis independently. The result distinguishes
`ready`, `recognition-only`, `synthesis-only`, and `unsupported`. A locale is
never marked ready unless both enabled providers explicitly list the exact
canonical locale. `getCommonSpeechLocales` returns the intersection for a UI
that wants to filter to true two-way voice support.


## Open-weight model candidates researched (not connected)

These are deployment candidates, not active providers. Do not expose their languages
as available in Aahana until a hosted endpoint is configured and end-to-end tests pass.

### Indian-language recognition (ASR)

- **IISc/ARTPARK Project Vaani — SraVaani 1.0**: 65 Indian languages and
  dialects, approximately 430M parameters / 900 MB FP16, MIT licence. It is
  the strongest candidate found for broad Indian-language recognition,
  including dialects such as Tulu and Bearybashe. It needs a model-serving
  environment; it is not a drop-in Vercel function.
- **AI4Bharat IndicConformer**: 22 scheduled Indian languages, MIT licence.
  It is another option for a narrower scheduled-language coverage target.

### Indian-language speech synthesis (TTS)

- **Maya 2 Native**: Assamese, Bengali, English, Gujarati, Hindi, Kannada,
  Malayalam, Marathi, Odia, Punjabi, Tamil and Telugu. Apache-2.0 weights and
  inference engine; approximately 5 GB BF16 weights, with documented NVIDIA
  GPU serving requirements. It offers streaming output and an
  OpenAI-compatible speech endpoint. Upstream component notices/licenses
  still need to be preserved.
- **Project Vaani — DhVaani 0.5**: 27 Indian languages, approximately 0.1B
  parameters, MIT licence according to the model catalogue. This is a lighter
  alternative to benchmark for Indic TTS.

### International recognition

- **OpenAI Whisper** offers multilingual ASR model sizes from tiny to large /
  turbo, with substantially different memory and latency requirements. It can
  be self-hosted, but its language accuracy must be measured per target locale.

### Deployment decision

There is no single candidate above that provides all Indian and international
languages for both speech directions. Aahana should use a routing layer:
SraVaani (or Whisper for international ASR) for recognition, Maya/DhVaani for
Indic synthesis, and a separately evaluated international TTS model for
languages outside their coverage. Benchmark latency, GPU memory, pronunciation,
code-switching, accents, concurrency, safety, and per-user cost before selecting
production defaults. Self-hosted inference avoids per-request vendor API fees,
not compute, hosting, storage, or operations costs.

Sources:
- Project Vaani models: https://vaani.iisc.ac.in/models
- SraVaani details: https://vaani.iisc.ac.in/models/sravaani
- Maya 2 Native model card: https://huggingface.co/maya-research/maya2-native
- AI4Bharat IndicConformer: https://github.com/AI4Bharat/IndicConformerASR
- OpenAI Whisper: https://github.com/openai/whisper


## Maya 2 Native adapter (server-side only)

`maya-tts-provider.mjs` implements the synthesis provider contract against the
documented private Maya HTTP endpoint:

- `POST /v1/audio/speech` with `input`, `language`, `voice`, and
  `response_format: "wav"`.
- Converts Aahana BCP 47 locales to Maya's language codes.
- Returns audio bytes and MIME type to the existing speech runtime.
- Passes through request cancellation, rejects unsupported locales and
  non-audio/empty/oversized responses.
- Accepts an optional bearer token for an authenticated reverse proxy; the
  Maya inference server itself does not implement authentication.

This adapter is inert until a trusted server-side caller supplies an endpoint.
Use HTTPS, or loopback HTTP for local development. Never put the model server
on the public internet without an authenticated gateway, network restrictions,
request limits and monitoring. Do not pass user-controlled URLs into the
adapter. Do not import or instantiate it from client components; keep endpoint
and proxy credentials in server-only environment variables.

The adapter has mock-based tests only. It has not been connected to a running
Maya model, and does not claim production speech support. The documented
reference deployment needs Linux, Python 3.10–3.12, CUDA 12.8 and an NVIDIA GPU;
the model documentation reports approximately 9.2 GB peak GPU memory even for
one serving seat. Benchmark actual hardware before provisioning.

Official interface and hardware documentation:
https://huggingface.co/maya-research/maya2-native


### SraVaani evaluation cautions

The published 65-language count is a coverage claim, not a promise of equal
accuracy. The current benchmark table reports average WER of 27.4 for Kannada,
26.2 for Tamil, 27.7 for Malayalam, 54.7 for Konkani and 57.3 for Santali;
WER varies by evaluation corpus and lower is better. Urdu and Kashmiri are not
supported in this release. The Hugging Face checkpoint is gated, and the
official quickstart uses `trust_remote_code=True`; review and pin the exact
model revision and audit its code before loading it in any service. Use
language-by-language test recordings from real speakers before enabling
recognition in the product.

Official benchmark and access notes:
https://vaani.iisc.ac.in/models/sravaani


### SraVaani server-side recognition adapter

`sravaani-asr-provider.server.mjs` implements the recognition provider contract
for Aahana's private wrapper at `POST /v1/audio/transcriptions`. It sends WAV
bytes as multipart form data with a bearer token, enforces HTTPS (or loopback
HTTP), caps audio at 15 MB, and requires an explicit deployment locale
allow-list. It is inert until both a private endpoint and token are injected.
The allow-list must contain only locales that have passed end-to-end testing
for that deployment; do not populate all 65 model languages by default.

The authenticated `/api/voice/transcribe` route calls this adapter when the
user is signed in, explicitly consents to send a recording, and the deployment
has opted in with a private endpoint, server-side token, and tested locale
allow-list. The chat composer records audio, converts it to WAV, and inserts
the returned transcript into the editable prompt; it does not auto-submit.

The wrapper currently performs multilingual recognition using the official
model interface; it does not accept a locale hint or guarantee that its output
matches the user's selected locale. The adapter's locale allow-list is an
Aahana product gate, not proof of language detection or accuracy. Adapter
tests are mocked, and the live model service and end-to-end device path remain
untested. The UI integration is present, but the provider is not active by
default.
