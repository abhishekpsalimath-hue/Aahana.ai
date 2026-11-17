import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSraVaaniAsrProvider } from "@/lib/voice/sravaani-asr-provider.server.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["audio/wav", "audio/x-wav", "audio/wave", "application/octet-stream"]);

function jsonError(error, status) {
  return NextResponse.json({ error }, { status });
}

function configuredProvider() {
  if (process.env.AAHANA_SRAVAANI_ENABLED !== "true") return null;
  const baseUrl = process.env.SRAVAANI_ASR_URL || "";
  const authorizationToken = process.env.SRAVAANI_API_TOKEN || "";
  const supportedLocales = (process.env.SRAVAANI_SUPPORTED_LOCALES || "")
    .split(",")
    .map((locale) => locale.trim())
    .filter(Boolean);

  if (!baseUrl || !authorizationToken || supportedLocales.length === 0) return null;

  return createSraVaaniAsrProvider({
    baseUrl,
    authorizationToken,
    supportedLocales,
  });
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return jsonError("Please sign in to use voice recognition.", 401);

  if (process.env.AAHANA_SRAVAANI_ENABLED !== "true") {
    return jsonError("Multilingual voice recognition is not enabled on this deployment.", 503);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Invalid audio upload.", 400);
  }

  // Uploading audio to a remote model requires a deliberate per-request consent.
  if (form.get("consent") !== "true") {
    return jsonError("Please confirm that you agree to send this audio to Aahana's configured speech service.", 403);
  }

  const file = form.get("file");
  const locale = form.get("locale");
  if (!(file instanceof File)) return jsonError("A WAV audio file is required.", 400);
  if (typeof locale !== "string" || !locale.trim()) return jsonError("Choose a speech language.", 400);
  if (!ALLOWED_TYPES.has(file.type)) return jsonError("Only WAV audio is accepted.", 415);
  if (!file.size || file.size > MAX_AUDIO_BYTES) return jsonError("Audio must be between 1 byte and 15 MB.", 413);

  const provider = configuredProvider();
  if (!provider || !provider.isAvailable()) {
    return jsonError("The private speech recognition service is not fully configured.", 503);
  }

  try {
    const result = await provider.transcribe({
      audio: file,
      locale,
      signal: request.signal,
    });
    return NextResponse.json({
      text: result.text,
      locale: result.locale,
      provider: "sravaani-1.0",
      audioRetainedByAahana: false,
    });
  } catch (error) {
    const status = error?.code === "UNSUPPORTED_LOCALE" ? 400
      : error?.code === "PROVIDER_UNAVAILABLE" ? 503
      : error?.code === "PROVIDER_CONNECTION_FAILED" ? 502
      : error?.code === "EMPTY_TRANSCRIPT" ? 422
      : 502;
    console.error("Aahana SraVaani transcription failed:", {
      code: error?.code || "UNKNOWN",
      userId: user.id,
    });
    return jsonError(
      status === 400 ? "This language is not enabled for speech recognition."
        : status === 422 ? "No speech could be transcribed. Try a clearer recording."
        : "Speech recognition is temporarily unavailable.",
      status,
    );
  }
}
