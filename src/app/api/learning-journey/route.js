import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseLearningJourney, serializeLearningJourney, validateLearningJourney } from "@/lib/learning/learning-memory";
import { parseLearningQuizProgress, serializeLearningQuizProgress, validateLearningQuizProgress, LEARNING_QUIZ_PREFIX } from "@/lib/learning/quiz-progress-memory.mjs";

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
    const [journeyResult, quizResult] = await Promise.all([
      supabase.from("user_memories").select("id, content, created_at")
        .eq("user_id", user.id).eq("source", "conversation")
        .like("content", "learning_journey:%").order("created_at", { ascending: false }).limit(50),
      supabase.from("user_memories").select("id, content, created_at")
        .eq("user_id", user.id).eq("source", "conversation")
        .like("content", "learning_quiz:%").order("created_at", { ascending: false }).limit(50),
    ]);
    if (journeyResult.error || quizResult.error) throw journeyResult.error || quizResult.error;
    const journeys = (journeyResult.data || []).map((row) => ({
      id: row.id, createdAt: row.created_at, journey: parseLearningJourney(row.content),
    })).filter((row) => row.journey);
    const quizProgress = (quizResult.data || []).map((row) => ({
      id: row.id, createdAt: row.created_at, progress: parseLearningQuizProgress(row.content),
    })).filter((row) => row.progress);
    return NextResponse.json({ enabled, journeys, quizProgress });
  } catch (error) {
    console.error("Aahana learning memory load failed:", error.message);
    return NextResponse.json({ error: "Could not load your learning memory." }, { status: 500 });
  }
}

async function readBoundedJson(request, maxBytes = 64 * 1024) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > maxBytes) {
    const error = new Error("Learning progress payload is too large.");
    error.status = 413;
    throw error;
  }
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Invalid request.");
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel().catch(() => {});
      const error = new Error("Learning progress payload is too large.");
      error.status = 413;
      throw error;
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return JSON.parse(text);
}

export async function POST(request) {
  const supabase = await createClient();
  const user = await getSignedInUser(supabase);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  let body;
  try {
    body = await readBoundedJson(request);
  } catch (error) {
    return NextResponse.json(
      { error: error?.status === 413 ? error.message : "Invalid request." },
      { status: error?.status || 400 },
    );
  }

  try {
    if (!(await memoryIsEnabled(supabase, user.id))) {
      return NextResponse.json({ error: "Enable private memory before saving learning progress." }, { status: 403 });
    }

    if (body?.quizProgress) {
      const progress = validateLearningQuizProgress(body.quizProgress);
      if (!progress) return NextResponse.json({ error: "This quiz progress could not be validated." }, { status: 400 });
      const { data, error } = await supabase.from("user_memories").insert({
        user_id: user.id, content: serializeLearningQuizProgress(progress),
        category: "other", source: "conversation",
      }).select("id, created_at").single();
      if (error || !data) throw error || new Error("No quiz progress was saved.");
      return NextResponse.json({ id: data.id, createdAt: data.created_at, progress }, { status: 201 });
    }

    const journey = validateLearningJourney(body?.journey);
    if (!journey) return NextResponse.json({ error: "This learning journey could not be validated." }, { status: 400 });
    const { data, error } = await supabase.from("user_memories").insert({
      user_id: user.id, content: serializeLearningJourney(journey),
      category: "other", source: "conversation",
    }).select("id, created_at").single();
    if (error || !data) throw error || new Error("No learning journey was saved.");
    return NextResponse.json({ id: data.id, createdAt: data.created_at, journey }, { status: 201 });
  } catch (error) {
    console.error("Aahana learning memory save failed:", error.message);
    return NextResponse.json({ error: "Could not save this learning progress." }, { status: 500 });
  }
}

export async function DELETE(request) {
  const supabase = await createClient();
  const user = await getSignedInUser(supabase);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "A learning memory ID is required." }, { status: 400 });

  const { data: row, error: lookupError } = await supabase.from("user_memories")
    .select("id, content").eq("id", id).eq("user_id", user.id)
    .eq("source", "conversation").maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Could not verify this learning memory." }, { status: 500 });
  const validRecord = row && (parseLearningJourney(row.content) ||
    (typeof row.content === "string" && row.content.startsWith(LEARNING_QUIZ_PREFIX) && parseLearningQuizProgress(row.content)));
  if (!validRecord) return NextResponse.json({ error: "Learning memory not found." }, { status: 404 });

  const { error } = await supabase.from("user_memories").delete()
    .eq("id", id).eq("user_id", user.id).eq("source", "conversation");
  if (error) {
    console.error("Aahana learning memory delete failed:", error.message);
    return NextResponse.json({ error: "Could not delete this learning memory." }, { status: 500 });
  }
  return NextResponse.json({ deleted: true });
}
