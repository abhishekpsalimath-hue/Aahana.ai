import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateChangeProposal } from "@/lib/build/change-proposal-policy.mjs";
import { toProposalSnapshotPath } from "@/lib/build/proposal-snapshot-policy.mjs";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
const MAX_SOURCE_FILES = 100;
const MAX_SOURCE_BYTES = 3 * 1024 * 1024;
async function readJsonBody(request, maxBytes) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Invalid proposal request.");
  const decoder = new TextDecoder();
  let bodyText = "";
  let bytesRead = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    if (bytesRead > maxBytes) {
      await reader.cancel().catch(() => {});
      const error = new Error("Proposal requests must be 4 MB or smaller.");
      error.status = 413;
      throw error;
    }
    bodyText += decoder.decode(value, { stream: true });
  }
  bodyText += decoder.decode();
  return JSON.parse(bodyText);
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in to review a project change proposal." }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Proposal requests must be 4 MB or smaller." }, { status: 413 });
  }

  let body;
  try { body = await readJsonBody(request, MAX_REQUEST_BYTES); } catch (error) {
    return NextResponse.json(
      { error: error?.status === 413 ? error.message : "Invalid proposal request." },
      { status: error?.status || 400 },
    );
  }

  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
    return NextResponse.json({ error: "Select a valid project first." }, { status: 400 });
  }
  if (!Array.isArray(body?.changes) || body.changes.length < 1 || body.changes.length > 50) {
    return NextResponse.json({ error: "Provide 1–50 proposed file changes to review." }, { status: 400 });
  }

  const { data: project, error: projectError } = await supabase.from("projects")
    .select("id").eq("id", projectId).eq("user_id", user.id).neq("status", "archived").maybeSingle();
  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const { data: rows, error: filesError } = await supabase.from("user_files")
    .select("bucket_id, object_path, original_filename, mime_type, size_bytes")
    .eq("user_id", user.id).eq("project_id", projectId)
    .order("created_at", { ascending: false }).limit(MAX_SOURCE_FILES + 1);
  if (filesError) {
    return NextResponse.json({ error: "Could not load the current project snapshot." }, { status: 500 });
  }

  if ((rows || []).length > MAX_SOURCE_FILES) {
    return NextResponse.json({ error: "This project has more than 100 stored files. Narrow the project before creating a proposal." }, { status: 413 });
  }

  const currentFiles = [];
  const usedPaths = new Set();
  let totalBytes = 0;
  for (const file of rows || []) {
    let path;
    try {
      path = toProposalSnapshotPath(file.original_filename);
    } catch {
      return NextResponse.json({ error: "A project source filename is not a safe relative path. Refresh the project files and resolve unsafe paths before proposing edits." }, { status: 409 });
    }
    if (!path) continue;
    if (file.bucket_id !== "aahana-private" ||
        typeof file.object_path !== "string" ||
        !file.object_path.startsWith(user.id + "/" + projectId + "/") ||
        !Number.isInteger(file.size_bytes) || file.size_bytes < 1 ||
        file.size_bytes > 1024 * 1024) {
      return NextResponse.json({ error: "A project source file failed ownership or size validation. Refresh the project files and try again." }, { status: 409 });
    }
    if (usedPaths.has(path)) {
      return NextResponse.json({ error: "The project contains duplicate source paths. Resolve the duplicate filenames before proposing edits." }, { status: 409 });
    }
    usedPaths.add(path);
    const { data: blob, error: downloadError } = await supabase.storage.from("aahana-private").download(file.object_path);
    if (downloadError || !blob || blob.size !== file.size_bytes || blob.size > 1024 * 1024 ||
        totalBytes + blob.size > MAX_SOURCE_BYTES) {
      return NextResponse.json({ error: "The current project snapshot could not be loaded within the safe size limits." }, { status: 409 });
    }
    totalBytes += blob.size;
    const source = await blob.text();
    currentFiles.push({ path, content: source });
  }

  try {
    const proposal = validateChangeProposal({ currentFiles, changes: body.changes });
    return NextResponse.json({
      ...proposal,
      projectId,
      snapshotFileCount: currentFiles.length,
      snapshotBytes: totalBytes,
      message: "Proposal validated against the current project snapshot. No project files were changed.",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "This change proposal could not be validated." }, { status: 400 });
  }
}
