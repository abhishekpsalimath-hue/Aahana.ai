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
