import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request, { params }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { id } = await params;
  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, title, mode, created_at, updated_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .maybeSingle();

  if (conversationError || !conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(100);

  if (messagesError) {
    console.error("Aahana conversation load failed:", messagesError.message);
    return NextResponse.json({ error: "Could not load this conversation." }, { status: 500 });
  }

  return NextResponse.json({ conversation, messages: messages || [] });
}
