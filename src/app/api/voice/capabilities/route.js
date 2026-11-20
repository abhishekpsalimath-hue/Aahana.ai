import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createMayaTtsProvider } from "@/lib/voice/maya-tts-provider.mjs";
import { createSraVaaniAsrProvider } from "@/lib/voice/sravaani-asr-provider.server.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Please sign in to view voice capabilities." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  let recognitionLocales = [];
  let synthesisLocales = [];
  let recognitionEnabled = false;
  let synthesisEnabled = false;

  if (process.env.AAHANA_SRAVAANI_ENABLED === "true") {
    const supportedLocales = (process.env.SRAVAANI_SUPPORTED_LOCALES || "").split(",").map((value) => value.trim()).filter(Boolean);
    try {
      const provider = createSraVaaniAsrProvider({
        baseUrl: process.env.SRAVAANI_ASR_URL || "",
        authorizationToken: process.env.SRAVAANI_API_TOKEN || "",
        supportedLocales,
      });
      recognitionEnabled = provider.isAvailable();
      if (recognitionEnabled) recognitionLocales = [...provider.supportedLocales];
    } catch {
      recognitionEnabled = false;
    }
  }

  if (process.env.AAHANA_MAYA_TTS_ENABLED === "true") {
    try {
      const provider = createMayaTtsProvider({
        baseUrl: process.env.MAYA_TTS_URL || "",
        authorizationToken: process.env.MAYA_TTS_API_TOKEN || "",
        voice: process.env.MAYA_TTS_VOICE || "Ahana",
      });
      synthesisEnabled = provider.isAvailable();
      if (synthesisEnabled) synthesisLocales = [...provider.supportedLocales];
    } catch {
      synthesisEnabled = false;
    }
  }

  return NextResponse.json({
    recognition: { enabled: recognitionEnabled, provider: recognitionEnabled ? "sravaani-1.0" : null, supportedLocales: recognitionLocales },
    synthesis: { enabled: synthesisEnabled, provider: synthesisEnabled ? "maya-2-native" : null, supportedLocales: synthesisLocales },
  }, { headers: { "Cache-Control": "no-store, private" } });
}
