import { validatePackageManifest, validateSandboxCommand } from "./sandbox-policy.mjs";

const COMMAND_TIMEOUT_MS = 120_000;

export function createWorkspaceCheckPlan(files) {
  if (!Array.isArray(files)) throw new Error("Workspace files are required to prepare checks.");
  const packageInfo = validatePackageManifest(files);
  if (!packageInfo.manifest) {
    return Object.freeze({
      available: false,
      reason: "No package.json was found; automatic Node.js checks are unavailable.",
      commands: Object.freeze([]),
      installRequired: false,
    });
  }

  const manifest = packageInfo.manifest;
  const scripts = manifest.scripts && typeof manifest.scripts === "object" && !Array.isArray(manifest.scripts)
    ? manifest.scripts
    : {};
  const hasLockfile = files.some((file) => file.path === "package-lock.json");
  const commands = [];

  if (packageInfo.hasDependencies) {
    const installArgs = hasLockfile
      ? ["ci", "--ignore-scripts", "--no-audit", "--no-fund", "--registry=https://registry.npmjs.org"]
      : ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--registry=https://registry.npmjs.org"];
    commands.push(validateSandboxCommand({ command: "npm", args: installArgs, timeout: COMMAND_TIMEOUT_MS }));
  }

  for (const scriptName of ["build", "test"]) {
    if (typeof scripts[scriptName] === "string" && scripts[scriptName].trim()) {
      commands.push(validateSandboxCommand({
        command: "npm",
        args: ["run", scriptName],
        timeout: COMMAND_TIMEOUT_MS,
      }));
    }
  }

  return Object.freeze({
    available: true,
    reason: commands.length
      ? "Checks are prepared but have not been executed."
      : "No dependencies or build/test scripts were declared.",
    commands: Object.freeze(commands),
    installRequired: packageInfo.hasDependencies,
    lockfileUsed: hasLockfile && packageInfo.hasDependencies,
    networkPolicy: "registry.npmjs.org-only-for-install; deny-all-for-project-scripts",
    executionApproved: false,
  });
}
