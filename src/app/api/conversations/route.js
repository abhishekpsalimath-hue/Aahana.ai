import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, mode, created_at, updated_at")
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Aahana history load failed:", error.message);
    return NextResponse.json({ error: "Could not load conversation history." }, { status: 500 });
  }

  return NextResponse.json({ conversations: data || [] });
}
