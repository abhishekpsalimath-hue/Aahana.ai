import {
  createSafeSandboxOptions,
  validatePackageManifest,
  validateWorkspaceFiles,
  validateWorkspacePath,
} from "./sandbox-policy.mjs";

const OUTPUT_LIMIT = 12_000;
const INSTALL_ARGS = [
  "install",
  "--ignore-scripts",
  "--package-lock=false",
  "--no-audit",
  "--no-fund",
  "--registry=https://registry.npmjs.org/",
];

function readOutput(result) {
  return Promise.all([
    result.stdout().catch(() => ""),
    result.stderr().catch(() => ""),
  ]);
}

export async function executeBuildTask({
  files,
  operation,
  entrypoint,
  projectId,
  sandboxName,
  SandboxClient,
  signal,
}) {
  const workspaceFiles = validateWorkspaceFiles(files);
  const { manifest, hasDependencies } = validatePackageManifest(workspaceFiles);

  if (!["build", "test", "run"].includes(operation)) {
    throw new Error("Unsupported build operation.");
  }

  let command;
  let args;
  if (operation === "build" || operation === "test") {
    const scriptName = operation === "build" ? "build" : "test";
    if (typeof manifest?.scripts?.[scriptName] !== "string" ||
        !manifest.scripts[scriptName].trim() ||
        manifest.scripts[scriptName].length > 500) {
      throw new Error("The project does not define a valid " + scriptName + " script.");
    }
    command = "npm";
    args = ["run", scriptName];
  } else {
    const safeEntrypoint = validateWorkspacePath(entrypoint);
    if (!workspaceFiles.some((file) => file.path === safeEntrypoint)) {
      throw new Error("The selected entrypoint must be one of the submitted workspace files.");
    }
    if (safeEntrypoint.endsWith(".py")) {
      command = "python3";
    } else if (/\.(?:cjs|mjs|js)$/i.test(safeEntrypoint)) {
      command = "node";
    } else {
      throw new Error("Only JavaScript and Python entrypoints are supported.");
    }
    args = ["--", safeEntrypoint];
  }

  if (signal?.aborted) throw new Error("Build cancelled.");
  const Client = SandboxClient || (await import("@vercel/sandbox")).Sandbox;
  const sandbox = await Client.create({
    ...createSafeSandboxOptions({ name: sandboxName, projectId }),
    ...(signal ? { signal } : {}),
  });

  let installOutput = "";
  try {
    await sandbox.writeFiles(workspaceFiles.map(({ path, content }) => ({
      path,
      content: Buffer.from(content, "utf8"),
    })));
    if (signal?.aborted) throw new Error("Build cancelled.");

    if (hasDependencies) {
      let installResult;
      await sandbox.update({ networkPolicy: { allow: ["registry.npmjs.org"] } });
      try {
        installResult = await sandbox.runCommand({
          cmd: "npm",
          args: INSTALL_ARGS,
          cwd: "/vercel/sandbox",
          ...(signal ? { signal } : {}),
        });
        const [stdout, stderr] = await readOutput(installResult);
        installOutput = (stdout + "\n" + stderr).slice(0, OUTPUT_LIMIT);
      } finally {
        // Never run project code while package-registry egress is enabled.
        await sandbox.update({ networkPolicy: "deny-all" });
      }

      if (signal?.aborted) throw new Error("Build cancelled.");
      if (installResult.exitCode !== 0) {
        return {
          status: "failed",
          operation,
          exitCode: installResult.exitCode ?? 1,
          stdout: installOutput,
          stderr: "Dependency installation failed. Project scripts were not executed.",
        };
      }
    }

    const result = await sandbox.runCommand({
      cmd: command,
      args,
      cwd: "/vercel/sandbox",
      ...(signal ? { signal } : {}),
    });
    if (signal?.aborted) throw new Error("Build cancelled.");
    const [stdout, stderr] = await readOutput(result);
    return {
      status: result.exitCode === 0 ? "passed" : "failed",
      operation,
      exitCode: result.exitCode ?? 1,
      stdout: (installOutput + stdout).slice(0, OUTPUT_LIMIT),
      stderr: stderr.slice(0, OUTPUT_LIMIT),
    };
  } finally {
    await sandbox.update({ networkPolicy: "deny-all" }).catch(() => {});
    await sandbox.stop();
  }
}
