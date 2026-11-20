import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const supabase = await createClient();
  if (request.signal.aborted) return new Response(null, { status: 499 });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (request.signal.aborted) return new Response(null, { status: 499 });

  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  let query = supabase
    .from("conversations")
    .select("id, title, mode, project_id, created_at, updated_at")
    .eq("user_id", user.id)
    .eq("is_archived", false);
  if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query.order("updated_at", { ascending: false }).limit(50).abortSignal(request.signal);
  if (request.signal.aborted) return new Response(null, { status: 499 });

  if (error) {
    console.error("Aahana history load failed:", error.message);
    return NextResponse.json({ error: "Could not load conversation history." }, { status: 500 });
  }

  return NextResponse.json({ conversations: data || [] });
}
