import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupportedSourceFile } from "@/lib/build/source-file-policy.mjs";

export const runtime = "nodejs";
const BUCKET = "aahana-private";
const MAX_BYTES = 1024 * 1024;

async function getOwnedSourceFile(supabase, userId, id) {
  const { data: file, error } = await supabase.from("user_files")
    .select("id, user_id, project_id, bucket_id, object_path, original_filename, mime_type")
    .eq("id", id).eq("user_id", userId).maybeSingle();
  if (error || !file || file.bucket_id !== BUCKET || !file.project_id ||
      !file.object_path.startsWith(userId + "/" + file.project_id + "/") ||
      !isSupportedSourceFile(file.original_filename, file.mime_type)) return null;
  return file;
}

export async function GET(_request, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const file = await getOwnedSourceFile(supabase, user.id, id);
  if (!file) return NextResponse.json({ error: "Project source file not found." }, { status: 404 });

  const { data: blob, error } = await supabase.storage.from(BUCKET).download(file.object_path);
  if (error || !blob || blob.size > MAX_BYTES) return NextResponse.json({ error: "Could not read this source file." }, { status: 400 });
  const content = await blob.text();
  if (content.includes("\u0000") || new TextEncoder().encode(content).byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "This file is not a supported text source." }, { status: 400 });
  }
  return NextResponse.json({ file: { id: file.id, name: file.original_filename, content } }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function PUT(request, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const file = await getOwnedSourceFile(supabase, user.id, id);
  if (!file) return NextResponse.json({ error: "Project source file not found." }, { status: 404 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid source update." }, { status: 400 }); }
  if (typeof body?.content !== "string") return NextResponse.json({ error: "Source content must be text." }, { status: 400 });
  const bytes = new TextEncoder().encode(body.content).byteLength;
  if (bytes < 1 || bytes > MAX_BYTES || body.content.includes("\u0000")) {
    return NextResponse.json({ error: "Source files must contain 1 byte to 1 MB of valid text." }, { status: 400 });
  }

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(
    file.object_path,
    new Blob([body.content], { type: file.mime_type }),
    { contentType: file.mime_type, upsert: true },
  );
  if (uploadError) return NextResponse.json({ error: "Could not save this source file." }, { status: 500 });

  const { error: updateError } = await supabase.from("user_files").update({ size_bytes: bytes })
    .eq("id", file.id).eq("user_id", user.id);
  if (updateError) return NextResponse.json({ error: "Source was saved, but its file metadata could not be updated." }, { status: 500 });

  return NextResponse.json({ saved: true, sizeBytes: bytes });
}
