import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// Temporary, privacy-safe diagnostic: never returns tokens, user IDs, or email.
export async function GET() {
  const cookieStore = await cookies();
  const hasSupabaseCookie = cookieStore.getAll().some(({ name }) => name.startsWith("sb-"));

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    const authenticated = Boolean(data?.claims?.sub);

    return NextResponse.json(
      {
        hasSupabaseCookie,
        authenticated,
        authError: error?.code || null,
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "Vercel-CDN-Cache-Control": "no-store",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { hasSupabaseCookie, authenticated: false, authError: "diagnostic_failed" },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "Vercel-CDN-Cache-Control": "no-store",
        },
      }
    );
  }
}
