import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createMayaTtsProvider } from "@/lib/voice/maya-tts-provider.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TEXT_LENGTH = 6000;

function jsonError(error, status) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

function configuredProvider() {
  if (process.env.AAHANA_MAYA_TTS_ENABLED !== "true") return null;
  const baseUrl = process.env.MAYA_TTS_URL || "";
  const authorizationToken = process.env.MAYA_TTS_API_TOKEN || "";
  const voice = process.env.MAYA_TTS_VOICE || "Ahana";
  if (!baseUrl || !authorizationToken) return null;
  try {
    return createMayaTtsProvider({ baseUrl, authorizationToken, voice });
  } catch {
    return null;
  }
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return jsonError("Please sign in to use spoken responses.", 401);

  if (process.env.AAHANA_MAYA_TTS_ENABLED !== "true") {
    return jsonError("Provider-backed spoken responses are not enabled on this deployment.", 503);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 256 * 1024) return jsonError("The text request is too large.", 413);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("A valid JSON request is required.", 400);
  }

  if (typeof body?.text !== "string" || !body.text.trim()) {
    return jsonError("Text to speak is required.", 400);
  }
  if (body.text.length > MAX_TEXT_LENGTH) {
    return jsonError("Text must be 6,000 characters or fewer.", 413);
  }
  if (typeof body.locale !== "string" || !body.locale.trim()) {
    return jsonError("A speech language is required.", 400);
  }

  const provider = configuredProvider();
  if (!provider || !provider.isAvailable()) {
    return jsonError("The private speech synthesis service is not fully configured.", 503);
  }

  try {
    const result = await provider.synthesize({
      text: body.text.trim(),
      locale: body.locale,
      signal: request.signal,
    });
    return new Response(result.audio, {
      status: 200,
      headers: {
        "Content-Type": result.mimeType || "audio/wav",
        "Content-Length": String(result.audio.byteLength),
        "Cache-Control": "no-store, private",
        "X-Aahana-Speech-Provider": "maya-2-native",
        "X-Aahana-Speech-Locale": result.locale,
      },
    });
  } catch (error) {
    const status = error?.code === "UNSUPPORTED_LOCALE" ? 400
      : error?.code === "PROVIDER_UNAVAILABLE" ? 503
      : error?.code === "INVALID_PROVIDER_CONFIG" || error?.code === "INSECURE_PROVIDER_ENDPOINT" ? 503
      : error?.code === "AUDIO_TOO_LARGE" ? 502
      : 502;
    console.error("Aahana Maya speech synthesis failed:", {
      code: error?.code || "UNKNOWN",
      userId: user.id,
    });
    return jsonError(
      status === 400 ? "This language is not enabled for spoken responses."
        : "Spoken responses are temporarily unavailable.",
      status,
    );
  }
}
