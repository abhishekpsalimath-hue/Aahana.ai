import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupportedSourceFile } from "@/lib/build/source-file-policy.mjs";
import { readBoundedJson } from "@/lib/chat/bounded-json.mjs";

const BUCKET = "aahana-private";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf", "text/plain", "text/markdown", "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/json", "text/javascript", "application/javascript", "text/css", "text/html", "text/x-python",
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
  try {
    // File metadata is a small control-plane payload, never an upload body.
    // Enforce the byte limit while streaming; Content-Length alone is not trusted.
    body = await readBoundedJson(request, 16 * 1024);
  } catch (error) {
    const status = error?.status === 413 ? 413 : 400;
    return NextResponse.json(
      { error: status === 413 ? "File metadata request is too large." : "Invalid request." },
      { status },
    );
  }
  const { objectPath, originalFilename, mimeType, sizeBytes, projectId = null } = body || {};
  const sourceFile = typeof originalFilename === "string" && typeof mimeType === "string" &&
    isSupportedSourceFile(originalFilename, mimeType);
  const maxUploadBytes = sourceFile ? 1024 * 1024 : MAX_BYTES;
  if (typeof objectPath !== "string" || !objectPath.startsWith(`${user.id}/`) ||
      typeof originalFilename !== "string" || !originalFilename.trim() || originalFilename.length > 255 ||
      typeof mimeType !== "string" || (!ALLOWED_TYPES.has(mimeType) && !sourceFile) ||
      !Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > maxUploadBytes ||
      (projectId !== null && typeof projectId !== "string")) {
    return NextResponse.json({ error: "Invalid file details. Source files must be 1 MB or smaller." }, { status: 400 });
  }

  if (projectId) {
    const { data: project, error } = await supabase.from("projects").select("id")
      .eq("id", projectId).eq("user_id", user.id).maybeSingle();
    if (error || !project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const parts = objectPath.split("/");
  if (parts.length !== 3 || !parts[2] || parts[1] !== (projectId || "personal")) return NextResponse.json({ error: "Invalid storage path." }, { status: 400 });
  const { data: objects, error: listError } = await supabase.storage.from(BUCKET)
    .list(`${parts[0]}/${parts[1]}`, { search: parts[2], limit: 10 });
  const storedObject = objects?.find((item) => item.name === parts[2]);
  if (listError || !storedObject || Number(storedObject.metadata?.size) !== sizeBytes || storedObject.metadata?.mimetype !== mimeType) {
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
