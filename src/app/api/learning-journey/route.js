import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseLearningJourney, serializeLearningJourney, validateLearningJourney } from "@/lib/learning/learning-memory";

async function getSignedInUser(supabase) {
  const { data: { user }, error } = await supabase.auth.getUser();
  return error || !user ? null : user;
}

async function memoryIsEnabled(supabase, userId) {
  const { data, error } = await supabase.from("user_memory_settings")
    .select("enabled").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data?.enabled === true;
}

export async function GET() {
  const supabase = await createClient();
  const user = await getSignedInUser(supabase);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  try {
    const enabled = await memoryIsEnabled(supabase, user.id);
    if (!enabled) return NextResponse.json({ enabled: false, journeys: [] });
    const { data, error } = await supabase.from("user_memories")
      .select("id, content, created_at")
      .eq("user_id", user.id)
      .eq("source", "conversation")
      .like("content", "learning_journey:%")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    const journeys = (data || []).map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      journey: parseLearningJourney(row.content),
    })).filter((row) => row.journey);
    return NextResponse.json({ enabled: true, journeys });
  } catch (error) {
    console.error("Aahana learning journey load failed:", error.message);
    return NextResponse.json({ error: "Could not load your learning journey." }, { status: 500 });
  }
}

export async function POST(request) {
  const supabase = await createClient();
  const user = await getSignedInUser(supabase);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const journey = validateLearningJourney(body?.journey);
  if (!journey) return NextResponse.json({ error: "This learning journey could not be validated." }, { status: 400 });

  try {
    if (!(await memoryIsEnabled(supabase, user.id))) {
      return NextResponse.json({ error: "Enable private memory before saving a learning journey." }, { status: 403 });
    }
    const { data, error } = await supabase.from("user_memories").insert({
      user_id: user.id,
      content: serializeLearningJourney(journey),
      category: "other",
      source: "conversation",
    }).select("id, created_at").single();
    if (error || !data) throw error || new Error("No learning journey was saved.");
    return NextResponse.json({ id: data.id, createdAt: data.created_at, journey }, { status: 201 });
  } catch (error) {
    console.error("Aahana learning journey save failed:", error.message);
    return NextResponse.json({ error: "Could not save this learning journey." }, { status: 500 });
  }
}

export async function DELETE(request) {
  const supabase = await createClient();
  const user = await getSignedInUser(supabase);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "A learning journey ID is required." }, { status: 400 });
  const { error, count } = await supabase.from("user_memories").delete({ count: "exact" })
    .eq("id", id).eq("user_id", user.id).eq("source", "conversation")
    .like("content", "learning_journey:%");
  if (error) {
    console.error("Aahana learning journey delete failed:", error.message);
    return NextResponse.json({ error: "Could not delete this learning journey." }, { status: 500 });
  }
  return NextResponse.json({ deleted: true, count: count ?? null });
}
