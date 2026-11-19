import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupportedSourceFile } from "@/lib/build/source-file-policy.mjs";

export const runtime = "nodejs";
const BUCKET = "aahana-private";
const MAX_BYTES = 1024 * 1024;

function versionFor(objectPath) {
  return createHash("sha256").update(objectPath).digest("hex");
}

async function getOwnedSourceFile(supabase, userId, id) {
  const { data: file, error } = await supabase.from("user_files")
    .select("id, user_id, project_id, bucket_id, object_path, original_filename, mime_type, size_bytes")
    .eq("id", id).eq("user_id", userId).maybeSingle();
  if (error || !file || file.bucket_id !== BUCKET || !file.project_id ||
      typeof file.object_path !== "string" || !file.object_path.startsWith(userId + "/" + file.project_id + "/") ||
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
  if (!Number.isInteger(file.size_bytes) || blob.size !== file.size_bytes) {
    return NextResponse.json({ error: "This source file changed or its stored size does not match. Reload the project before editing." }, { status: 409 });
  }
  let content;
  try { content = new TextDecoder("utf-8", { fatal: true }).decode(await blob.arrayBuffer()); }
  catch { return NextResponse.json({ error: "This file is not valid UTF-8 text." }, { status: 400 }); }
  if (content.includes("\u0000") || new TextEncoder().encode(content).byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "This file is not a supported text source." }, { status: 400 });
  }
  return NextResponse.json({ file: { id: file.id, name: file.original_filename, content }, version: versionFor(file.object_path) }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function PUT(request, { params }) {
  const { id } = await params;
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BYTES + 64 * 1024) return NextResponse.json({ error: "Source update is too large." }, { status: 413 });
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const file = await getOwnedSourceFile(supabase, user.id, id);
  if (!file) return NextResponse.json({ error: "Project source file not found." }, { status: 404 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid source update." }, { status: 400 }); }
  if (typeof body?.content !== "string" || typeof body?.version !== "string" || !/^[a-f0-9]{64}$/.test(body.version)) {
    return NextResponse.json({ error: "Reload this source file before saving your changes." }, { status: 400 });
  }
  if (body.version !== versionFor(file.object_path)) {
    return NextResponse.json({ error: "This source file changed after you opened it. Reload the latest version before saving." }, { status: 409 });
  }
  const bytes = new TextEncoder().encode(body.content).byteLength;
  if (bytes < 1 || bytes > MAX_BYTES || body.content.includes("\u0000")) {
    return NextResponse.json({ error: "Source files must contain 1 byte to 1 MB of valid text." }, { status: 400 });
  }

  const lockToken = randomUUID();
  const { data: lockAcquired, error: lockError } = await supabase.rpc("acquire_aahana_build_lock", {
    p_project_id: file.project_id,
    p_lock_token: lockToken,
  });
  if (lockError) {
    console.error("Aahana source edit lock could not be acquired:", lockError.message);
    return NextResponse.json({ error: "Project editing protection is not ready. Please try again." }, { status: 503 });
  }
  if (lockAcquired !== true) {
    return NextResponse.json({ error: "This project is currently building. Try saving your source again when execution finishes." }, { status: 409 });
  }

  try {
    const safeName = file.original_filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "source";
    const nextPath = user.id + "/" + file.project_id + "/" + randomUUID() + "-" + safeName;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(
      nextPath,
      new Blob([body.content], { type: file.mime_type }),
      { contentType: file.mime_type, upsert: false },
    );
    if (uploadError) return NextResponse.json({ error: "Could not save this source file." }, { status: 500 });

    // The object path is the version pointer. A conditional row update ensures only one
    // concurrent editor can advance the file from the version it originally opened.
    const { data: updated, error: updateError } = await supabase.from("user_files")
      .update({ object_path: nextPath, size_bytes: bytes })
      .eq("id", file.id).eq("user_id", user.id).eq("object_path", file.object_path)
      .select("id").maybeSingle();

    if (updateError || !updated) {
      await supabase.storage.from(BUCKET).remove([nextPath]).catch(() => ({}));
      if (updateError) {
        console.error("Aahana source metadata update failed:", updateError.message);
        return NextResponse.json({ error: "Could not save this source file." }, { status: 500 });
      }
      return NextResponse.json({ error: "This source file was saved elsewhere first. Reload the latest version before trying again." }, { status: 409 });
    }

    const { error: cleanupError } = await supabase.storage.from(BUCKET).remove([file.object_path]);
    if (cleanupError) console.error("Aahana previous source version cleanup failed:", cleanupError.message);

    return NextResponse.json({ saved: true, sizeBytes: bytes, version: versionFor(nextPath) });
  } finally {
    const { error: releaseError } = await supabase.rpc("release_aahana_build_lock", { p_lock_token: lockToken });
    if (releaseError) console.error("Aahana source edit lock release failed:", releaseError.message);
  }
}
