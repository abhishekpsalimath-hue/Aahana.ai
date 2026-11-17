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
