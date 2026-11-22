import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCreativeProviderStatus } from "@/lib/creative/creative-director.mjs";
export const runtime = "nodejs";
export async function GET(request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Please sign in to inspect Build Mode status." }, { status: 401 });
  // Vercel Functions receive the OIDC token on each request, not as a runtime env var.
  // Keep the env fallback for local development and non-function build contexts.
  const sandboxIdentityAvailable = Boolean(
    request.headers.get("x-vercel-oidc-token") || process.env.VERCEL_OIDC_TOKEN
  );
  return NextResponse.json({
    enabled: process.env.AAHANA_BUILD_ENGINE_ENABLED === "true",
    previewEnabled: process.env.AAHANA_PREVIEW_ENGINE_ENABLED === "true" && sandboxIdentityAvailable,
    videoEnabled: process.env.AAHANA_VIDEO_GENERATION_ENABLED === "true" &&
      Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN),
    imageEditingEnabled: process.env.AAHANA_IMAGE_EDITING_ENABLED === "true" &&
      Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN),
    creativeProviders: getCreativeProviderStatus(process.env),
    sandboxIdentityAvailable,
    environment: process.env.VERCEL_ENV === "preview" ? "preview" : process.env.VERCEL_ENV === "production" ? "production" : "development",
  }, { headers: { "Cache-Control": "private, no-store" } });
}
