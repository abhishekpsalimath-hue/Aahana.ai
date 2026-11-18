import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeBuildTask } from "@/lib/build/build-engine.mjs";
import { validateWorkspaceFiles } from "@/lib/build/sandbox-policy.mjs";
import { authorizeWorkspaceExecution, createWorkspaceDigest } from "@/lib/build/workspace-approval-policy.mjs";

export const runtime = "nodejs";
export const maxDuration = 180;

const activeBuildUsers = new Set();
const MAX_SOURCE_FILES = 100;
const MAX_SOURCE_BYTES = 3 * 1024 * 1024;
const TEXT_MIME_TYPES = new Set(["text/plain", "text/markdown", "text/x-python", "application/json"]);

function isProjectSourceFile(file) {
  const extension = String(file.original_filename || "").toLowerCase().split(".").pop();
  return TEXT_MIME_TYPES.has(file.mime_type) ||
    /^(?:js|jsx|ts|tsx|mjs|cjs|css|html|htm|json|md|txt|py|toml|yaml|yml|sql)$/.test(extension);
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in to use Build Mode." }, { status: 401 });
  }
  if (process.env.AAHANA_BUILD_ENGINE_ENABLED !== "true") {
    return NextResponse.json({ error: "Aahana Build Engine is not enabled in this environment yet." }, { status: 503 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid build request." }, { status: 400 });
  }
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const operation = body?.operation;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
    return NextResponse.json({ error: "Select a valid project first." }, { status: 400 });
  }
  if (!["build", "test"].includes(operation)) {
    return NextResponse.json({ error: "Choose build or test." }, { status: 400 });
  }
  if (activeBuildUsers.has(user.id)) {
    return NextResponse.json({ error: "A build is already running for this account." }, { status: 409 });
  }

  const { data: project, error: projectError } = await supabase
    .from("projects").select("id").eq("id", projectId).eq("user_id", user.id).neq("status", "archived").maybeSingle();
  if (projectError || !project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const { data: rows, error: filesError } = await supabase
    .from("user_files")
    .select("bucket_id, object_path, original_filename, mime_type, size_bytes")
    .eq("user_id", user.id).eq("project_id", projectId)
    .order("created_at", { ascending: false }).limit(MAX_SOURCE_FILES);
  if (filesError) return NextResponse.json({ error: "Could not load this project's files." }, { status: 500 });

  const eligible = (rows || []).filter((file) =>
    file.bucket_id === "aahana-private" &&
    typeof file.object_path === "string" &&
    file.object_path.startsWith(`${user.id}/${projectId}/`) &&
    Number.isInteger(file.size_bytes) && file.size_bytes > 0 &&
    file.size_bytes <= 1024 * 1024 && isProjectSourceFile(file)
  );
  if (!eligible.length) {
    return NextResponse.json({ error: "Upload your project's source files first. A package.json file is required for build or test." }, { status: 400 });
  }

  activeBuildUsers.add(user.id);
  try {
    const workspace = [];
    let totalBytes = 0;
    const usedPaths = new Set();
    for (const file of eligible) {
      if (workspace.length >= MAX_SOURCE_FILES) break;
      const filename = String(file.original_filename || "").replace(/[^a-zA-Z0-9._/-]/g, "_").replace(/^\/+/, "");
      if (!filename || filename.split("/").some((part) => !part || part === "." || part === "..")) continue;
      const path = filename;
      if (usedPaths.has(path)) continue;
      const { data: blob, error: downloadError } = await supabase.storage.from("aahana-private").download(file.object_path);
      if (downloadError || !blob) continue;
      const content = await blob.text();
      const bytes = new TextEncoder().encode(content).byteLength;
      if (bytes < 1 || bytes > 1024 * 1024 || totalBytes + bytes > MAX_SOURCE_BYTES) continue;
      workspace.push({ path, content });
      usedPaths.add(path);
      totalBytes += bytes;
    }

    const files = validateWorkspaceFiles(workspace);
    if (!files.some((file) => file.path === "package.json")) {
      return NextResponse.json({ error: "This project needs a package.json file before Aahana can run its build or tests." }, { status: 400 });
    }

    if (!body?.approval) {
      return NextResponse.json({
        approvalRequired: true,
        projectId,
        operation,
        workspaceDigest: createWorkspaceDigest(files),
        sourceFileCount: files.length,
        sourceBytes: totalBytes,
        message: "Review this exact source snapshot and explicitly approve before Aahana starts the isolated Sandbox.",
      }, { status: 409, headers: { "Cache-Control": "private, no-store" } });
    }

    authorizeWorkspaceExecution({
      userId: user.id,
      projectOwnerId: user.id,
      projectId,
      approval: body.approval,
      files,
      operation,
      entrypoint: undefined,
    });

    const result = await executeBuildTask({
      files,
      operation,
      projectId: process.env.VERCEL_PROJECT_ID || "prj_Ts4f4dcI3IPvBOw5IWPdsfmumbHK",
      sandboxName: "aahana-project-" + randomUUID().replace(/-/g, "").slice(0, 20),
    });
    return NextResponse.json({ ...result, sourceFileCount: files.length, sourceBytes: totalBytes }, { status: result.status === "passed" ? 200 : 422 });
  } catch (error) {
    console.error("Aahana project build failed:", error?.message || "unknown error");
    return NextResponse.json({ error: error?.message || "Aahana could not run this project safely." }, { status: 400 });
  } finally {
    activeBuildUsers.delete(user.id);
  }
}
