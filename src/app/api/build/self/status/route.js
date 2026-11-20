import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSelfBuildConfig, isSelfBuildOwner } from "@/lib/build/self-build-policy.mjs";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Please sign in to inspect Self-Build." }, { status: 401 });

  const config = getSelfBuildConfig();
  const ownerAllowed = isSelfBuildOwner(user.email, config);
  const agentReady = process.env.AAHANA_AI_ENABLED === "true" &&
    (process.env.AAHANA_AI_PROVIDER || "groq").toLowerCase() === "groq" &&
    Boolean(process.env.GROQ_API_KEY);
  return NextResponse.json({
    enabled: config.enabled && ownerAllowed,
    agentReady,
    validationEnabled: process.env.VERCEL_ENV === "preview" && process.env.AAHANA_SELF_BUILD_VALIDATION_ENABLED === "true",
    configured: config.enabled,
    ownerAllowed,
    repository: ownerAllowed ? config.repository : null,
    missingConfiguration: config.enabled ? [] : config.missing,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
