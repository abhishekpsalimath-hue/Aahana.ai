import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "aahana-private";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf", "text/plain", "text/markdown", "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png", "image/jpeg", "image/webp",
]);

export async function GET(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const projectId = new URL(request.url).searchParams.get("projectId");
  let query = supabase.from("user_files")
    .select("id, project_id, original_filename, mime_type, size_bytes, created_at")
    .eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
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

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const { objectPath, originalFilename, mimeType, sizeBytes, projectId = null } = body || {};
  if (typeof objectPath !== "string" || !objectPath.startsWith(`${user.id}/`) ||
      typeof originalFilename !== "string" || !originalFilename.trim() || originalFilename.length > 255 ||
      typeof mimeType !== "string" || !ALLOWED_TYPES.has(mimeType) ||
      !Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_BYTES ||
      (projectId !== null && typeof projectId !== "string")) {
    return NextResponse.json({ error: "Invalid file details." }, { status: 400 });
  }

  if (projectId) {
    const { data: project, error } = await supabase.from("projects").select("id")
      .eq("id", projectId).eq("user_id", user.id).maybeSingle();
    if (error || !project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const parts = objectPath.split("/");
  if (parts.length !== 3 || !parts[2]) return NextResponse.json({ error: "Invalid storage path." }, { status: 400 });
  const { data: objects, error: listError } = await supabase.storage.from(BUCKET)
    .list(`${parts[0]}/${parts[1]}`, { search: parts[2], limit: 10 });
  if (listError || !objects?.some((item) => item.name === parts[2])) {
    return NextResponse.json({ error: "Uploaded file could not be verified." }, { status: 400 });
  }

  const { data, error } = await supabase.from("user_files").insert({
    user_id: user.id, project_id: projectId, bucket_id: BUCKET,
    object_path: objectPath, original_filename: originalFilename.trim(),
    mime_type: mimeType, size_bytes: sizeBytes,
  }).select("id, project_id, original_filename, mime_type, size_bytes, created_at").single();
  if (error || !data) {
    console.error("Aahana file record insert failed:", error?.message);
    return NextResponse.json({ error: "Could not save file details." }, { status: 500 });
  }
  return NextResponse.json({ file: data }, { status: 201 });
}
