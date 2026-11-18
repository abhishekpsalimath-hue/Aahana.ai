import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isFounderUser } from "./founder-access-policy.mjs";

export async function getFounderSession() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      supabase: null,
      user: null,
      response: NextResponse.json({ error: "Please sign in." }, { status: 401 }),
    };
  }

  const founderId = process.env.AAHANA_FOUNDER_USER_ID;
  if (!founderId) {
    return {
      supabase: null,
      user: null,
      response: NextResponse.json({
        error: "The private founder workspace is locked until AAHANA_FOUNDER_USER_ID is configured.",
      }, { status: 503 }),
    };
  }

  if (!isFounderUser(user.id, founderId)) {
    return {
      supabase: null,
      user: null,
      response: NextResponse.json({ error: "This workspace is private to its founder." }, { status: 403 }),
    };
  }

  return { supabase, user, response: null };
}
