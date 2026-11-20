import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Sandbox } from "@vercel/sandbox";
import { createClient } from "@/lib/supabase/server";
import { validateWorkspaceFiles, validatePackageManifest } from "@/lib/build/sandbox-policy.mjs";
import { getPreviewCommand } from "@/lib/build/preview-policy.mjs";
import { isSupportedSourceFile, isSafePrivateObjectPath } from "@/lib/build/source-file-policy.mjs";

export const runtime = "nodejs";
export const maxDuration = 180;
const MAX_SOURCE_FILES = 100;
const MAX_PROJECT_FILE_ROWS = 500;
const MAX_SOURCE_BYTES = 3 * 1024 * 1024;
const INSTALL_ARGS = ["install", "--ignore-scripts", "--package-lock=false", "--no-audit", "--no-fund", "--registry=https://registry.npmjs.org/"];

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Please sign in to open a live preview." }, { status: 401 });
  if (request.signal.aborted) return NextResponse.json({ error: "Preview cancelled." }, { status: 499 });
  if (process.env.AAHANA_PREVIEW_ENGINE_ENABLED !== "true") {
    return NextResponse.json({ error: "Live preview is not enabled in this environment yet." }, { status: 503 });
  }
  const hasSandboxIdentity = Boolean(request.headers.get("x-vercel-oidc-token") || process.env.VERCEL_OIDC_TOKEN);
  if (!hasSandboxIdentity) return NextResponse.json({ error: "Secure preview runtime is unavailable in this environment." }, { status: 503 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid preview request." }, { status: 400 }); }
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)) {
    return NextResponse.json({ error: "Select a valid project first." }, { status: 400 });
  }
  const { data: project, error: projectError } = await supabase.from("projects").select("id")
    .eq("id", projectId).eq("user_id", user.id).neq("status", "archived").maybeSingle();
  if (projectError || !project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const { data: rows, error: filesError } = await supabase.from("user_files")
    .select("bucket_id, object_path, original_filename, mime_type, size_bytes")
    .eq("user_id", user.id).eq("project_id", projectId).order("created_at", { ascending: false }).limit(MAX_PROJECT_FILE_ROWS + 1);
  if (filesError) return NextResponse.json({ error: "Could not load this project's files." }, { status: 500 });
  if ((rows || []).length > MAX_PROJECT_FILE_ROWS) return NextResponse.json({ error: "This project has too many stored files to preview safely." }, { status: 413 });

  const sourceCandidates = (rows || []).filter((file) => isSupportedSourceFile(file.original_filename, file.mime_type));
  if (!sourceCandidates.length || sourceCandidates.length > MAX_SOURCE_FILES) {
    return NextResponse.json({ error: "Upload between 1 and 100 supported source files to this project first." }, { status: 400 });
  }
  if (sourceCandidates.some((file) => file.bucket_id !== "aahana-private" ||
      !isSafePrivateObjectPath(file.object_path, user.id, projectId) ||
      !Number.isInteger(file.size_bytes) || file.size_bytes <= 0 || file.size_bytes > 1024 * 1024) ||
      sourceCandidates.reduce((sum, file) => sum + file.size_bytes, 0) > MAX_SOURCE_BYTES) {
    return NextResponse.json({ error: "Project source files have invalid metadata or exceed the 3 MB preview limit." }, { status: 413 });
  }

  const workspace = [];
  const paths = new Set();
  let totalBytes = 0;
  for (const file of sourceCandidates) {
    if (request.signal.aborted) return NextResponse.json({ error: "Preview cancelled." }, { status: 499 });
    const filename = String(file.original_filename || "").replace(/[^a-zA-Z0-9._/-]/g, "_").replace(/^\/+/, "");
    if (!filename || filename.split("/").some((part) => !part || part === "." || part === "..") || paths.has(filename)) {
      return NextResponse.json({ error: "Project files contain an invalid or duplicate workspace path." }, { status: 400 });
    }
    const { data: blob, error } = await supabase.storage.from("aahana-private").download(file.object_path);
    if (error || !blob) return NextResponse.json({ error: "A project source file could not be downloaded." }, { status: 502 });
    let content;
    try { content = new TextDecoder("utf-8", { fatal: true }).decode(await blob.arrayBuffer()); }
    catch { return NextResponse.json({ error: "A project source file is not valid UTF-8 text." }, { status: 400 }); }
    const bytes = new TextEncoder().encode(content).byteLength;
    if (bytes !== file.size_bytes || bytes < 1 || bytes > 1024 * 1024 || totalBytes + bytes > MAX_SOURCE_BYTES) {
      return NextResponse.json({ error: "A source file changed or exceeds the preview workspace limit. Reload the project." }, { status: 409 });
    }
    workspace.push({ path: filename, content });
    paths.add(filename);
    totalBytes += bytes;
  }

  let files;
  let manifest;
  let command;
  try {
    files = validateWorkspaceFiles(workspace);
    const validated = validatePackageManifest(files);
    manifest = validated.manifest;
    if (!manifest) throw new Error("A package.json file is required to run a website preview.");
    command = getPreviewCommand(manifest);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Project files are not ready for preview." }, { status: 400 });
  }

  let sandbox;
  try {
    sandbox = await Sandbox.create({
      name: "aahana-preview-" + randomUUID().replace(/-/g, "").slice(0, 24),
      image: "vercel/sandbox/universal:latest",
      region: "bom1",
      resources: { vcpus: 1 },
      timeout: 10 * 60 * 1000,
      persistent: false,
      networkPolicy: "deny-all",
      ports: [3000],
      ...(request.signal ? { signal: request.signal } : {}),
    });
    if (request.signal.aborted) throw new Error("Preview cancelled.");
    await sandbox.writeFiles(files.map(({ path, content }) => ({ path, content: Buffer.from(content, "utf8") })));

    const hasDependencies = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]
      .some((key) => Object.keys(manifest[key] || {}).length > 0);
    if (hasDependencies) {
      await sandbox.update({ networkPolicy: { allow: ["registry.npmjs.org"] } });
      let install;
      try {
        install = await sandbox.runCommand({ cmd: "npm", args: INSTALL_ARGS, cwd: "/vercel/sandbox", signal: request.signal });
      } finally {
        await sandbox.update({ networkPolicy: "deny-all" });
      }
      if (install.exitCode !== 0) {
        const diagnostic = (await install.stderr().catch(() => "")).slice(0, 3000);
        await sandbox.stop();
        return NextResponse.json({ error: "Dependency installation failed. " + diagnostic }, { status: 422 });
      }
    }

    if (request.signal.aborted) throw new Error("Preview cancelled.");
    const server = await sandbox.runCommand({ cmd: command.command, args: command.args, cwd: "/vercel/sandbox", detached: true, signal: request.signal });
    if (server.exitCode && server.exitCode !== 0) {
      const diagnostic = (await server.stderr().catch(() => "")).slice(0, 3000);
      await sandbox.stop();
      return NextResponse.json({ error: "The development server could not start. " + diagnostic }, { status: 422 });
    }

    let ready = false;
    for (let attempt = 0; attempt < 35; attempt += 1) {
      if (request.signal.aborted) throw new Error("Preview cancelled.");
      const ping = await sandbox.runCommand("bash", ["-c", "curl -fsS http://127.0.0.1:3000/ >/dev/null && echo ready || true"]);
      if ((await ping.stdout()).includes("ready")) { ready = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!ready) {
      await sandbox.stop();
      return NextResponse.json({ error: "The website did not become ready within 35 seconds. Check the dev script and build output, then try again." }, { status: 504 });
    }

    return NextResponse.json({
      ready: true,
      previewUrl: sandbox.domain(3000),
      expiresInMinutes: 10,
      sourceFileCount: files.length,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (sandbox) await sandbox.stop().catch(() => {});
    if (request.signal.aborted) return NextResponse.json({ error: "Preview cancelled." }, { status: 499 });
    console.error("Aahana live preview failed:", error?.message || "unknown error");
    return NextResponse.json({ error: error?.message || "Aahana could not start this preview safely." }, { status: 400 });
  }
}
