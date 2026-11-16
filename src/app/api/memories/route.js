import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const CATEGORIES = new Set(["personal", "preference", "project", "goal", "other"]);

async function getUser(supabase) {
  const { data: { user }, error } = await supabase.auth.getUser();
  return error || !user ? null : user;
}

export async function GET() {
  const supabase = await createClient();
  const user = await getUser(supabase);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const [{ data: settings, error: settingsError }, { data: memories, error: memoriesError }] = await Promise.all([
    supabase.from("user_memory_settings").select("enabled, consented_at, updated_at").eq("user_id", user.id).maybeSingle(),
    supabase.from("user_memories").select("id, content, category, source, created_at, updated_at")
      .eq("user_id", user.id).order("updated_at", { ascending: false }).limit(100),
  ]);
  if (settingsError || memoriesError) {
    console.error("Aahana memory load failed:", settingsError?.message || memoriesError?.message);
    return NextResponse.json({ error: "Could not load memory settings." }, { status: 500 });
  }
  return NextResponse.json({ enabled: settings?.enabled === true, consentedAt: settings?.consented_at || null, memories: memories || [] });
}

export async function POST(request) {
  const supabase = await createClient();
  const user = await getUser(supabase);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  if (body?.action === "enable" || body?.action === "disable") {
    const enabled = body.action === "enable";
    const { error } = await supabase.from("user_memory_settings").upsert({
      user_id: user.id,
      enabled,
      consented_at: enabled ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) {
      console.error("Aahana memory consent update failed:", error.message);
      return NextResponse.json({ error: "Could not update memory settings." }, { status: 500 });
    }
    return NextResponse.json({ enabled });
  }

  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const category = CATEGORIES.has(body?.category) ? body.category : "personal";
  if (!content || content.length > 1200) {
    return NextResponse.json({ error: "Memory must contain between 1 and 1,200 characters." }, { status: 400 });
  }
  const { data: settings } = await supabase.from("user_memory_settings").select("enabled")
    .eq("user_id", user.id).maybeSingle();
  if (settings?.enabled !== true) {
    return NextResponse.json({ error: "Turn on private memory before saving anything." }, { status: 403 });
  }
  const { data, error } = await supabase.from("user_memories")
    .insert({ user_id: user.id, content, category, source: "user" })
    .select("id, content, category, source, created_at, updated_at").single();
  if (error || !data) {
    console.error("Aahana memory save failed:", error?.message);
    return NextResponse.json({ error: "Could not save this memory." }, { status: 500 });
  }
  return NextResponse.json({ memory: data }, { status: 201 });
}

export async function DELETE(request) {
  const supabase = await createClient();
  const user = await getUser(supabase);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "A memory ID is required." }, { status: 400 });
  let deletion = supabase.from("user_memories").delete({ count: "exact" }).eq("user_id", user.id);
  if (id !== "all") deletion = deletion.eq("id", id);
  const { error, count } = await deletion;
  if (error) {
    console.error("Aahana memory delete failed:", error.message);
    return NextResponse.json({ error: "Could not delete this memory." }, { status: 500 });
  }
  return NextResponse.json({ deleted: true, count: count ?? null });
}
