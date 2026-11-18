import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeBuildTask } from "@/lib/build/build-engine.mjs";
import { validateWorkspaceFiles } from "@/lib/build/sandbox-policy.mjs";
import { authorizeWorkspaceExecution } from "@/lib/build/workspace-approval-policy.mjs";

export const runtime = "nodejs";
export const maxDuration = 180;

const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
const activeBuildUsers = new Set();

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in to use Build Mode." }, { status: 401 });
  }

  // Runtime execution is opt-in and remains disabled until an owner enables it.
  if (process.env.AAHANA_BUILD_ENGINE_ENABLED !== "true") {
    return NextResponse.json({ error: "Aahana Build Engine is not enabled yet." }, { status: 503 });
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Build submissions must be 4 MB or smaller." }, { status: 413 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid build request." }, { status: 400 });
  }

  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const operation = body?.operation;
  const entrypoint = typeof body?.entrypoint === "string" ? body.entrypoint : undefined;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
    return NextResponse.json({ error: "A valid project ID is required." }, { status: 400 });
  }
  if (!["build", "test", "run"].includes(operation)) {
    return NextResponse.json({ error: "Choose build, test or run." }, { status: 400 });
  }

  let files;
  try {
    files = validateWorkspaceFiles(body?.files);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Invalid workspace files." }, { status: 400 });
  }

  if (activeBuildUsers.has(user.id)) {
    return NextResponse.json({ error: "A build is already running for this account. Please wait for it to finish." }, { status: 409 });
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  try {
    authorizeWorkspaceExecution({
      userId: user.id,
      projectOwnerId: user.id,
      projectId,
      approval: body?.approval,
      files,
      operation,
      entrypoint,
    });
  } catch (error) {
    return NextResponse.json({
      error: error?.message || "Explicit owner approval is required before execution.",
    }, { status: 403 });
  }

  activeBuildUsers.add(user.id);
  try {
    const result = await executeBuildTask({
      files,
      operation,
      entrypoint,
      projectId: process.env.VERCEL_PROJECT_ID || "prj_Ts4f4dcI3IPvBOw5IWPdsfmumbHK",
      sandboxName: "aahana-build-" + randomUUID().replace(/-/g, "").slice(0, 20),
    });
    return NextResponse.json(result, { status: result.status === "passed" ? 200 : 422 });
  } catch (error) {
    console.error("Aahana isolated build failed:", error?.message || "unknown error");
    return NextResponse.json({
      error: "Aahana could not complete this isolated build. No production files were changed.",
    }, { status: 502 });
  } finally {
    activeBuildUsers.delete(user.id);
  }
}
