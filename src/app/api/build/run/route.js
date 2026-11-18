import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeBuildTask } from "@/lib/build/build-engine.mjs";
import { validateWorkspaceFiles } from "@/lib/build/sandbox-policy.mjs";

export const runtime = "nodejs";
export const maxDuration = 180;

const MAX_REQUEST_BYTES = 4 * 1024 * 1024;

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

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  // A database-backed lock prevents duplicate builds across serverless instances.
  // If the migration/RPC is unavailable, fail closed instead of running unlocked.
  const lockToken = randomUUID();
  const { data: lockAcquired, error: lockError } = await supabase.rpc("acquire_aahana_build_lock", {
    p_project_id: projectId,
    p_lock_token: lockToken,
  });
  if (lockError) {
    console.error("Aahana build lock could not be acquired:", lockError.message);
    return NextResponse.json({ error: "Build protection is not ready. Please try again later." }, { status: 503 });
  }
  if (lockAcquired !== true) {
    return NextResponse.json({ error: "A build is already running for this account. Please wait for it to finish." }, { status: 409 });
  }

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
    const { error: releaseError } = await supabase.rpc("release_aahana_build_lock", {
      p_lock_token: lockToken,
    });
    if (releaseError) console.error("Aahana build lock release failed:", releaseError.message);
  }
}
