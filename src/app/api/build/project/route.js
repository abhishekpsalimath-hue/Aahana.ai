import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeBuildTask } from "@/lib/build/build-engine.mjs";
import { validateWorkspaceFiles } from "@/lib/build/sandbox-policy.mjs";
export const runtime = "nodejs";
export const maxDuration = 180;
const MAX_SOURCE_FILES = 100;
const MAX_PROJECT_FILE_ROWS = 500;
const MAX_SOURCE_BYTES = 3 * 1024 * 1024;
const SOURCE_EXTENSIONS = /^(?:js|jsx|ts|tsx|mjs|cjs|css|html|htm|json|md|txt|py|toml|yaml|yml|sql)$/;
const SOURCE_MIME_TYPES = new Set(["text/plain", "text/markdown", "text/x-python", "application/json", "text/javascript", "application/javascript", "text/css", "text/html"]);
function isProjectSourceFile(file) {
  const extension = String(file.original_filename || "").toLowerCase().split(".").pop();
  return SOURCE_MIME_TYPES.has(file.mime_type) || SOURCE_EXTENSIONS.test(extension);
}
export async function POST(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Please sign in to use Build Mode." }, { status: 401 });
  if (request.signal.aborted) return NextResponse.json({ error: "Build cancelled." }, { status: 499 });
  if (process.env.AAHANA_BUILD_ENGINE_ENABLED !== "true") return NextResponse.json({ error: "Aahana Build Engine is not enabled in this environment yet." }, { status: 503 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid build request." }, { status: 400 }); }
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const operation = body?.operation;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) return NextResponse.json({ error: "Select a valid project first." }, { status: 400 });
  if (!["build", "test"].includes(operation)) return NextResponse.json({ error: "Choose build or test." }, { status: 400 });
  const { data: project, error: projectError } = await supabase.from("projects").select("id").eq("id", projectId).eq("user_id", user.id).neq("status", "archived").maybeSingle();
  if (projectError || !project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
  const { data: rows, error: filesError } = await supabase.from("user_files").select("bucket_id, object_path, original_filename, mime_type, size_bytes").eq("user_id", user.id).eq("project_id", projectId).order("created_at", { ascending: false }).limit(MAX_PROJECT_FILE_ROWS + 1);
  if (filesError) return NextResponse.json({ error: "Could not load this project’s files." }, { status: 500 });
  if ((rows || []).length > MAX_PROJECT_FILE_ROWS) return NextResponse.json({ error: "This project has too many stored files to build safely. Remove unused files and try again." }, { status: 413 });
  const eligible = (rows || []).filter((file) => file.bucket_id === "aahana-private" && typeof file.object_path === "string" && file.object_path.startsWith(user.id + "/" + projectId + "/") && Number.isInteger(file.size_bytes) && file.size_bytes > 0 && isProjectSourceFile(file));
  if (eligible.length > MAX_SOURCE_FILES) return NextResponse.json({ error: "A build can include up to 100 source files. Remove unused source files and try again." }, { status: 413 });
  if (!eligible.length) return NextResponse.json({ error: "Upload project source files first. A package.json file is required." }, { status: 400 });
  const lockToken = randomUUID();
  const { data: lockAcquired, error: lockError } = await supabase.rpc("acquire_aahana_build_lock", { p_project_id: projectId, p_lock_token: lockToken });
  if (lockError) { console.error("Aahana build lock could not be acquired:", lockError.message); return NextResponse.json({ error: "Build protection is not ready. Please try again later." }, { status: 503 }); }
  if (lockAcquired !== true) return NextResponse.json({ error: "A build is already running for this account." }, { status: 409 });
  try {
    const workspace = [];
    let totalBytes = 0;
    const usedPaths = new Set();
    for (const file of eligible) {
      if (request.signal.aborted) return NextResponse.json({ error: "Build cancelled." }, { status: 499 });
      if (workspace.length >= MAX_SOURCE_FILES) break;
      const filename = String(file.original_filename || "").replace(/[^a-zA-Z0-9._/-]/g, "_").replace(/^\/+/, "");
      if (!filename || filename.split("/").some((part) => !part || part === "." || part === "..") || usedPaths.has(filename)) return NextResponse.json({ error: "Project files contain an invalid or duplicate workspace path. Rename the conflicting files and retry." }, { status: 400 });
      const { data: blob, error: downloadError } = await supabase.storage.from("aahana-private").download(file.object_path);
      if (downloadError || !blob) return NextResponse.json({ error: "A source file could not be downloaded. No partial build was started." }, { status: 502 });
      if (request.signal.aborted) return NextResponse.json({ error: "Build cancelled." }, { status: 499 });
      let content;
      try { content = new TextDecoder("utf-8", { fatal: true }).decode(await blob.arrayBuffer()); }
      catch { return NextResponse.json({ error: "A source file is not valid UTF-8. Fix or remove it before building." }, { status: 400 }); }
      if (request.signal.aborted) return NextResponse.json({ error: "Build cancelled." }, { status: 499 });
      const bytes = new TextEncoder().encode(content).byteLength;
      if (bytes !== file.size_bytes) return NextResponse.json({ error: "A source file changed or its stored size does not match. Reload the project before building." }, { status: 409 });
      if (bytes < 1 || bytes > 1024 * 1024 || totalBytes + bytes > MAX_SOURCE_BYTES) return NextResponse.json({ error: "Project source files exceed the 3 MB build workspace limit. Remove or reduce files and retry." }, { status: 413 });
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