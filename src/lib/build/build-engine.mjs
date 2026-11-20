import { Writable } from "node:stream";
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

function createBoundedOutputSink(limit = OUTPUT_LIMIT, onOverflow = () => {}) {
  let remaining = limit;
  let byteLength = 0;
  let truncated = false;
  const chunks = [];
  const stream = new Writable({
    write(chunk, encoding, callback) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
      const keptLength = Math.min(remaining, buffer.length);
      if (keptLength > 0) {
        // Copy only retained bytes, not the larger SDK chunk.
        chunks.push(Buffer.from(buffer.subarray(0, keptLength)));
        byteLength += keptLength;
        remaining -= keptLength;
      }
      if (keptLength < buffer.length && !truncated) {
        truncated = true;
        onOverflow();
      }
      callback();
    },
  });
  return {
    stream,
    text: () => Buffer.concat(chunks, byteLength).toString("utf8"),
    get truncated() { return truncated; },
  };
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

  const Client = SandboxClient || (await import("@vercel/sandbox")).Sandbox;
  if (signal?.aborted) throw new Error("Build cancelled before sandbox creation.");
  const sandbox = await Client.create(
    createSafeSandboxOptions({ name: sandboxName, projectId }),
  );
  let stopPromise;
  const stopSandbox = () => {
    if (!stopPromise) stopPromise = Promise.resolve().then(() => sandbox.stop());
    return stopPromise;
  };
  const onAbort = () => { void stopSandbox().catch(() => {}); };
  signal?.addEventListener("abort", onAbort, { once: true });
  if (signal?.aborted) onAbort();

  let installOutput = "";
  try {
    await sandbox.writeFiles(workspaceFiles.map(({ path, content }) => ({
      path,
      content: Buffer.from(content, "utf8"),
    })));

    if (hasDependencies) {
      let installResult;
      await sandbox.update({ networkPolicy: { allow: ["registry.npmjs.org"] } });
      try {
        const installController = new AbortController();
        const installSignal = signal ? AbortSignal.any([signal, installController.signal]) : installController.signal;
        const abortInstallOnOverflow = () => installController.abort(new Error("Build output exceeded the 12 KB limit."));
        const installStdout = createBoundedOutputSink(OUTPUT_LIMIT, abortInstallOnOverflow);
        const installStderr = createBoundedOutputSink(OUTPUT_LIMIT, abortInstallOnOverflow);
        try {
          installResult = await sandbox.runCommand({
            cmd: "npm",
            args: INSTALL_ARGS,
            cwd: "/vercel/sandbox",
            stdout: installStdout.stream,
            stderr: installStderr.stream,
            signal: installSignal,
          });
        } catch (error) {
          if (installController.signal.aborted && !signal?.aborted) {
            throw new Error("Build output exceeded the 12 KB limit.", { cause: error });
          }
          throw error;
        }
        // Drain excess output without retaining it, bounding server memory.
        installOutput = (installStdout.text() + "\n" + installStderr.text()).slice(0, OUTPUT_LIMIT);
      } finally {
        // Never run project code while package-registry egress is enabled.
        await sandbox.update({ networkPolicy: "deny-all" });
      }

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

    const taskController = new AbortController();
    const taskSignal = signal ? AbortSignal.any([signal, taskController.signal]) : taskController.signal;
    const abortTaskOnOverflow = () => taskController.abort(new Error("Build output exceeded the 12 KB limit."));
    const taskStdout = createBoundedOutputSink(OUTPUT_LIMIT, abortTaskOnOverflow);
    const taskStderr = createBoundedOutputSink(OUTPUT_LIMIT, abortTaskOnOverflow);
    let result;
    try {
      result = await sandbox.runCommand({
        cmd: command,
        args,
        cwd: "/vercel/sandbox",
        stdout: taskStdout.stream,
        stderr: taskStderr.stream,
        signal: taskSignal,
      });
    } catch (error) {
      if (taskController.signal.aborted && !signal?.aborted) {
        throw new Error("Build output exceeded the 12 KB limit.", { cause: error });
      }
      throw error;
    }
    return {
      status: result.exitCode === 0 ? "passed" : "failed",
      operation,
      exitCode: result.exitCode ?? 1,
      stdout: (installOutput + taskStdout.text()).slice(0, OUTPUT_LIMIT),
      stderr: taskStderr.text().slice(0, OUTPUT_LIMIT),
    };
  } finally {
    signal?.removeEventListener("abort", onAbort);
    await sandbox.update({ networkPolicy: "deny-all" }).catch(() => {});
    await stopSandbox();
  }
}
