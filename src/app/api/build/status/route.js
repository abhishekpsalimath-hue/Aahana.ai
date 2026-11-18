import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Please sign in to inspect Build Mode status." }, { status: 401 });
  return NextResponse.json({
    enabled: process.env.AAHANA_BUILD_ENGINE_ENABLED === "true",
    sandboxIdentityAvailable: Boolean(process.env.VERCEL_OIDC_TOKEN),
    environment: process.env.VERCEL_ENV === "preview" ? "preview" : process.env.VERCEL_ENV === "production" ? "production" : "development",
  }, { headers: { "Cache-Control": "private, no-store" } });
}