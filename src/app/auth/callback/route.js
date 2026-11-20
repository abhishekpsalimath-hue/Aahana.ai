import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSafeAuthNext, isSupportedOtpType } from "@/lib/auth/callback-utils.mjs";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = getSafeAuthNext(searchParams.get("next"));

  if (code || (tokenHash && isSupportedOtpType(type))) {
    const supabase = await createClient();
    const result = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

    if (!result.error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth_callback", origin));
}
