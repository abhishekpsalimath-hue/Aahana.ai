import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readBoundedJson } from "@/lib/chat/bounded-json.mjs";
import { executeBuildTask } from "@/lib/build/build-engine.mjs";
import { validateWorkspaceFiles } from "@/lib/build/sandbox-policy.mjs";
import { isSupportedSourceFile, isSafePrivateObjectPath } from "@/lib/build/source-file-policy.mjs";
export const runtime = "nodejs";
export const maxDuration = 180;
const MAX_SOURCE_FILES = 100;
const MAX_PROJECT_FILE_ROWS = 500;
const MAX_SOURCE_BYTES = 3 * 1024 * 1024;
export async function POST(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Please sign in to use Build Mode." }, { status: 401 });
  if (process.env.AAHANA_BUILD_ENGINE_ENABLED !== "true") return NextResponse.json({ error: "Aahana Build Engine is not enabled in this environment yet." }, { status: 503 });
  if (request.signal.aborted) return NextResponse.json({ error: "Build cancelled." }, { status: 499 });
  let body;
  try {
    body = await readBoundedJson(request, 16 * 1024);
  } catch (error) {
    if (request.signal.aborted) return NextResponse.json({ error: "Build cancelled." }, { status: 499 });
    return NextResponse.json(
      { error: error?.status === 413 ? "Build request is too large." : "Invalid build request." },
      { status: error?.status || 400 },
    );
  }
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const operation = body?.operation;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) return NextResponse.json({ error: "Select a valid project first." }, { status: 400 });
  if (!["build", "test"].includes(operation)) return NextResponse.json({ error: "Choose build or test." }, { status: 400 });
  const { data: project, error: projectError } = await supabase.from("projects").select("id").eq("id", projectId).eq("user_id", user.id).neq("status", "archived").maybeSingle();
  if (projectError || !project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const { data: rows, error: filesError } = await supabase.from("user_files")
    .select("bucket_id, object_path, original_filename, mime_type, size_bytes")
    .eq("user_id", user.id).eq("project_id", projectId)
    .order("created_at", { ascending: false }).limit(MAX_PROJECT_FILE_ROWS + 1);
  if (filesError) return NextResponse.json({ error: "Could not load this project’s files." }, { status: 500 });
  if ((rows || []).length > MAX_PROJECT_FILE_ROWS) {
    return NextResponse.json({ error: "This project has too many stored files to build safely." }, { status: 413 });
  }
  const sourceCandidates = (rows || []).filter((file) => isSupportedSourceFile(file.original_filename, file.mime_type));
  if (!sourceCandidates.length || sourceCandidates.length > MAX_SOURCE_FILES) {
    return NextResponse.json({ error: "Upload between 1 and 100 supported source files to this project first." }, { status: 400 });
  }
  if (sourceCandidates.some((file) => file.bucket_id !== "aahana-private" ||
      !isSafePrivateObjectPath(file.object_path, user.id, projectId) ||
      !Number.isInteger(file.size_bytes) || file.size_bytes <= 0 || file.size_bytes > 1024 * 1024) ||
      sourceCandidates.reduce((sum, file) => sum + file.size_bytes, 0) > MAX_SOURCE_BYTES) {
    return NextResponse.json({ error: "Project source files have invalid metadata or exceed the 3 MB build limit." }, { status: 413 });
  }
  const lockToken = randomUUID();
  const { data: lockAcquired, error: lockError } = await supabase.rpc("acquire_aahana_build_lock", { p_project_id: projectId, p_lock_token: lockToken });
  if (lockError) { console.error("Aahana build lock could not be acquired:", lockError.message); return NextResponse.json({ error: "Build protection is not ready. Please try again later." }, { status: 503 }); }
  if (lockAcquired !== true) return NextResponse.json({ error: "A build is already running for this account." }, { status: 409 });
  try {
    const workspace = [];
    let totalBytes = 0;
    const usedPaths = new Set();
    for (const file of sourceCandidates) {
      if (request.signal.aborted) return NextResponse.json({ error: "Build cancelled." }, { status: 499 });
      const filename = String(file.original_filename || "").replace(/[^a-zA-Z0-9._/-]/g, "_").replace(/^\/+/, "");
      if (!filename || filename.split("/").some((part) => !part || part === "." || part === "..") || usedPaths.has(filename)) {
        return NextResponse.json({ error: "Project files contain an invalid or duplicate workspace path." }, { status: 400 });
      }
      const { data: blob, error: downloadError } = await supabase.storage.from("aahana-private").download(file.object_path);
      if (downloadError || !blob) {
        return NextResponse.json({ error: "A project source file could not be downloaded." }, { status: 502 });
      }
      let content;
      try { content = new TextDecoder("utf-8", { fatal: true }).decode(await blob.arrayBuffer()); }
      catch { return NextResponse.json({ error: "A project source file is not valid UTF-8 text." }, { status: 400 }); }
      if (request.signal.aborted) return NextResponse.json({ error: "Build cancelled." }, { status: 499 });
      const bytes = new TextEncoder().encode(content).byteLength;
      if (bytes !== file.size_bytes || bytes < 1 || bytes > 1024 * 1024 || totalBytes + bytes > MAX_SOURCE_BYTES) {
        return NextResponse.json({ error: "A source file changed or exceeds the build workspace limit. Reload the project." }, { status: 409 });
      }
      workspace.push({ path: filename, content });
      usedPaths.add(filename);
      totalBytes += bytes;
    }
    const files = validateWorkspaceFiles(workspace);
    if (!files.some((file) => file.path === "package.json")) return NextResponse.json({ error: "This project needs a package.json file before Aahana can run its build or tests." }, { status: 400 });
    const result = await executeBuildTask({ files, operation, projectId: process.env.VERCEL_PROJECT_ID || "prj_Ts4f4dcI3IPvBOw5IWPdsfmumbHK", sandboxName: "aahana-project-" + randomUUID().replace(/-/g, "").slice(0, 20), signal: request.signal });
    return NextResponse.json({ ...result, sourceFileCount: files.length, sourceBytes: totalBytes }, { status: result.status === "passed" ? 200 : 422 });
  } catch (error) {
    if (request.signal.aborted) return NextResponse.json({ error: "Build cancelled." }, { status: 499 });
    console.error("Aahana project build failed:", error?.message || "unknown error");
    return NextResponse.json({ error: error?.message || "Aahana could not run this project safely." }, { status: 400 });
  } finally {
    const { error: releaseError } = await supabase.rpc("release_aahana_build_lock", { p_lock_token: lockToken });
    if (releaseError) console.error("Aahana build lock release failed:", releaseError.message);
  }
}