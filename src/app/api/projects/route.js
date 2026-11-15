import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TYPES = ["web", "app", "design", "other"];

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, description, project_type, status, created_at, updated_at")
    .eq("user_id", user.id)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Aahana projects load failed:", error.message);
    return NextResponse.json({ error: "Could not load projects." }, { status: 500 });
  }
  return NextResponse.json({ projects: data || [] });
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const project_type = TYPES.includes(body?.project_type) ? body.project_type : "other";

  if (!name || name.length > 80) return NextResponse.json({ error: "Project name must be 1–80 characters." }, { status: 400 });
  if (description.length > 500) return NextResponse.json({ error: "Description must be 500 characters or fewer." }, { status: 400 });

  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, name, description: description || null, project_type })
    .select("id, name, description, project_type, status, created_at, updated_at")
    .single();

  if (error || !data) {
    console.error("Aahana project create failed:", error?.message);
    return NextResponse.json({ error: "Could not create this project." }, { status: 500 });
  }
  return NextResponse.json({ project: data }, { status: 201 });
}
