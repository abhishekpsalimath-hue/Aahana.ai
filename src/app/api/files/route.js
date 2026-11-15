import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BUCKET = "aahana-private";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export async function GET(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const projectId = new URL(request.url).searchParams.get("projectId");
  let query = supabase.from("user_files")
    .select("id, project_id, original_filename, mime_type, size_bytes, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  query = projectId ? query.eq("project_id", projectId) : query.is("project_id", null);
  const { data, error } = await query;
  if (error) {
    console.error("Aahana files list failed:", error.message);
    return NextResponse.json({ error: "Could not load files." }, { status: 500 });
  }
  return NextResponse.json({ files: data || [] });
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  let form;
  try { form = await request.formData(); } catch {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }
  const file = form.get("file");
  const rawProjectId = form.get("projectId");
  const projectId = typeof rawProjectId === "string" && rawProjectId ? rawProjectId : null;

  if (!file || typeof file.arrayBuffer !== "function") return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  if (file.size < 1 || file.size > MAX_BYTES) return NextResponse.json({ error: "Files must be between 1 byte and 10 MB." }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "This file type is not supported." }, { status: 415 });

  if (projectId) {
    const { data: project, error } = await supabase.from("projects").select("id").eq("id", projectId).eq("user_id", user.id).maybeSingle();
    if (error || !project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "upload";
  const objectPath = `${user.id}/${projectId || "personal"}/${randomUUID()}-${safeName}`;
  const bytes = await file.arrayBuffer();
  const { error: storageError } = await supabase.storage.from(BUCKET).upload(objectPath, bytes, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (storageError) {
    console.error("Aahana storage upload failed:", storageError.message);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }

  const { data, error: insertError } = await supabase.from("user_files").insert({
    user_id: user.id,
    project_id: projectId,
    bucket_id: BUCKET,
    object_path: objectPath,
    original_filename: file.name.slice(0, 255),
    mime_type: file.type,
    size_bytes: file.size,
  }).select("id, project_id, original_filename, mime_type, size_bytes, created_at").single();

  if (insertError || !data) {
    await supabase.storage.from(BUCKET).remove([objectPath]);
    console.error("Aahana file record insert failed:", insertError?.message);
    return NextResponse.json({ error: "Could not save file details." }, { status: 500 });
  }
  return NextResponse.json({ file: data }, { status: 201 });
}
