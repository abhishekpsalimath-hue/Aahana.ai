import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request, { params }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const { id } = await params;
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const updates = {};
  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (!name || name.length > 80) return NextResponse.json({ error: "Project name must be 1–80 characters." }, { status: 400 });
    updates.name = name;
  }
  if (typeof body?.description === "string") {
    const description = body.description.trim();
    if (description.length > 500) return NextResponse.json({ error: "Description must be 500 characters or fewer." }, { status: 400 });
    updates.description = description || null;
  }
  if (body?.status === "archived") updates.status = "archived";
  if (!Object.keys(updates).length) return NextResponse.json({ error: "No valid changes supplied." }, { status: 400 });
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, name, description, project_type, status, created_at, updated_at")
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: "Project not found or could not be updated." }, { status: 404 });
  return NextResponse.json({ project: data });
}

export async function DELETE(_request, { params }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const { id } = await params;
  const { error } = await supabase.from("projects").delete().eq("id", id).eq("user_id", user.id);
  if (error) {
    console.error("Aahana project delete failed:", error.message);
    return NextResponse.json({ error: "Could not delete this project." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
