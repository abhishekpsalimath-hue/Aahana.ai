import { NextResponse } from "next/server";
import { Sandbox } from "@vercel/sandbox";
import { createClient } from "@/lib/supabase/server";
import { getSelfBuildConfig, isSelfBuildOwner, isAllowedSelfBuildPath, validateSelfBuildChangeSet } from "@/lib/build/self-build-policy.mjs";
import { getSelfBuildRepository, getSelfBuildFile } from "@/lib/build/github-app.mjs";

export const runtime = "nodejs";
export const maxDuration = 180;

const MAX_FILES = 3;
const MAX_INSTALL_MS = 75_000;
const MAX_BUILD_MS = 90_000;
const MAX_OUTPUT_CHARS = 5000;
const REPOSITORY_URL = "https://github.com/abhishekpsalimath-hue/Aahana.ai.git";
const REPOSITORY_DIR = "Aahana.ai";

function tail(value) {
  return String(value || "").slice(-MAX_OUTPUT_CHARS);
}

async function commandOutput(command) {
  const [stdout, stderr] = await Promise.all([
    command.stdout().catch(() => ""),
    command.stderr().catch(() => ""),
  ]);
  return { stdout: tail(stdout), stderr: tail(stderr) };
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Please sign in to validate Aahana's proposed changes." }, { status: 401 });

  const config = getSelfBuildConfig();
  if (config.repository !== "abhishekpsalimath-hue/Aahana.ai") {
    return NextResponse.json({ error: "Self-validation is restricted to the configured Aahana repository." }, { status: 503 });
  }
  if (!isSelfBuildOwner(user.email, config)) {
    return NextResponse.json({ error: "Isolated self-validation is available only to its authorized owner." }, { status: 403 });
  }
  if (process.env.VERCEL_ENV !== "preview" || process.env.AAHANA_SELF_BUILD_VALIDATION_ENABLED !== "true") {
    return NextResponse.json({ error: "Isolated self-validation is not enabled in this Preview environment." }, { status: 503 });
  }
  if (!request.headers.get("x-vercel-oidc-token") && !process.env.VERCEL_OIDC_TOKEN) {
    return NextResponse.json({ error: "Secure isolated execution is unavailable in this environment." }, { status: 503 });
  }

  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid validation request." }, { status: 400 }); }

  if (!Array.isArray(body?.files) || body.files.length < 1 || body.files.length > MAX_FILES) {
    return NextResponse.json({ error: "Validate one to three reviewed files at a time." }, { status: 400 });
  }
  const baseSha = typeof body.baseSha === "string" ? body.baseSha : "";
  if (!/^[a-f0-9]{40}$/i.test(baseSha)) {
    return NextResponse.json({ error: "Refresh Aahana's repository before validating this change set." }, { status: 400 });
  }

  let sandbox;
  try {
    const repository = await getSelfBuildRepository();
    if (repository.baseSha !== baseSha) {
      return NextResponse.json({ error: "Aahana's base branch changed. Refresh the repository and review the latest source before validating." }, { status: 409 });
    }

    const seen = new Set();
    const reviewed = [];
    for (const item of body.files) {
      if (!item || typeof item !== "object" || Array.isArray(item) ||
          typeof item.path !== "string" || !isAllowedSelfBuildPath(item.path) ||
          seen.has(item.path) || typeof item.baseVersion !== "string" ||
          typeof item.content !== "string") {
        return NextResponse.json({ error: "The reviewed change set contains an invalid or duplicate file." }, { status: 400 });
      }
      seen.add(item.path);
      const original = await getSelfBuildFile({ path: item.path, ref: baseSha });
      if (original.sha !== item.baseVersion) {
        return NextResponse.json({ error: "A source file changed after it was reviewed. Refresh and review it again: " + item.path }, { status: 409 });
      }
      if (original.content === item.content) {
        return NextResponse.json({ error: "Remove unchanged files from the validation request." }, { status: 400 });
      }
      reviewed.push({ path: item.path, content: item.content });
    }

    const changeSet = validateSelfBuildChangeSet({ baseSha, files: reviewed });
    sandbox = await Sandbox.create({
      source: { type: "git", url: REPOSITORY_URL, depth: 1, revision: baseSha },
      image: "vercel/sandbox/universal:latest",
      region: "bom1",
      resources: { vcpus: 1 },
      timeout: 170_000,
      persistent: false,
      networkPolicy: { allow: ["github.com", "codeload.github.com"] },
    });

    // Remove GitHub access before overlaying agent-authored code or running it.
    await sandbox.update({ networkPolicy: "deny-all" });
    await sandbox.writeFiles(changeSet.files.map((file) => ({
      path: REPOSITORY_DIR + "/" + file.path,
      content: Buffer.from(file.content, "utf8"),
    })));

    // Remove any committed environment or npm config files before dependency resolution.
    await sandbox.runCommand({ cmd: "find", args: [".", "-type", "f", "(", "-name", ".env*", "-o", "-name", ".npmrc", ")", "-delete"], cwd: REPOSITORY_DIR, timeout: 5000 });

    // Dependencies may come only from the public npm registry. Lifecycle scripts are disabled.
    await sandbox.update({ networkPolicy: { allow: ["registry.npmjs.org"] } });
    const install = await sandbox.runCommand({
      cmd: "npm",
      args: ["install", "--ignore-scripts", "--package-lock=false", "--no-audit", "--no-fund", "--registry=https://registry.npmjs.org/"],
      cwd: REPOSITORY_DIR,
      timeout: MAX_INSTALL_MS,
    });
    const installOutput = await commandOutput(install);
    await sandbox.update({ networkPolicy: "deny-all" });
    if (install.exitCode !== 0) {
      return NextResponse.json({
        ok: false,
        stage: "dependency_install",
        message: "Dependency installation failed in the isolated environment.",
        output: installOutput,
      }, { status: 422 });
    }

    const build = await sandbox.runCommand({
      cmd: "npm",
      args: ["run", "build"],
      cwd: REPOSITORY_DIR,
      timeout: MAX_BUILD_MS,
    });
    const buildOutput = await commandOutput(build);
    return NextResponse.json({
      ok: build.exitCode === 0,
      stage: "tests_and_build",
      message: build.exitCode === 0
        ? "Aahana's tests and production build passed in an isolated sandbox."
        : "Aahana's tests or production build failed. Review the diagnostics before changing the proposal.",
      output: buildOutput,
      baseSha,
      filesValidated: changeSet.files.length,
    }, { status: build.exitCode === 0 ? 200 : 422, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Aahana isolated self-validation failed:", error?.message || "unknown error");
    return NextResponse.json({ error: "Aahana could not complete isolated validation. No repository changes were committed." }, { status: 502 });
  } finally {
    if (sandbox) await sandbox.stop().catch(() => {});
  }
}
