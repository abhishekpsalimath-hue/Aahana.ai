const BLOCKED_SEGMENTS = new Set([
  ".git", ".vercel", ".next", "node_modules", "coverage", "dist", "build",
]);

const BLOCKED_FILE_NAMES = new Set([
  ".env", ".env.local", ".env.production", ".npmrc", ".pypirc", "npm-shrinkwrap.json",
]);

const ALLOWED_EXECUTABLES = new Set(["node", "npm", "python3"]);
const ALLOWED_NPM_COMMANDS = new Set(["install", "ci", "run", "test", "exec", "list"]);
const MAX_ARGUMENTS = 40;
const MAX_ARGUMENT_LENGTH = 1000;
const MAX_TIMEOUT_MS = 120_000;
const MAX_FILES = 100;
const MAX_FILE_BYTES = 1 * 1024 * 1024;
const MAX_TOTAL_FILE_BYTES = 3 * 1024 * 1024;
const AUTOMATED_ACTIONS = new Set([
  "create-preview",
  "write-sandbox-files",
  "run-build",
  "run-tests",
  "read-diff",
  "discard-sandbox",
]);

export function validateWorkspacePath(input) {
  if (typeof input !== "string" || input.length < 1 || input.length > 240) {
    throw new Error("Invalid workspace path.");
  }

  if (/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(input) || input.includes("\\") || input.startsWith("/") || /^[a-zA-Z]:/.test(input)) {
    throw new Error("Workspace paths must be relative POSIX paths.");
  }

  const segments = input.split("/");
  if (segments.some((segment) =>
    !segment ||
    segment === "." ||
    segment === ".." ||
    BLOCKED_SEGMENTS.has(segment.toLowerCase()) ||
    BLOCKED_FILE_NAMES.has(segment.toLowerCase()) ||
    segment.toLowerCase().startsWith(".env.")
  )) {
    throw new Error("Workspace path is not permitted.");
  }

  return segments.join("/");
}

export function createSafeSandboxOptions({ name, projectId }) {
  if (typeof name !== "string" || !/^[a-zA-Z0-9_-]{8,64}$/.test(name)) {
    throw new Error("Invalid sandbox name.");
  }
  if (typeof projectId !== "string" || !/^prj_[A-Za-z0-9]+$/.test(projectId)) {
    throw new Error("Invalid Vercel project ID.");
  }

  // Deliberately do not pass application environment variables, credentials,
  // repository credentials, user secrets, or production configuration.
  // Project scope comes from the deployment's Vercel OIDC identity.
  // Do not pass project IDs or credentials into the guest VM.
  return Object.freeze({
    name,
    image: "vercel/sandbox/universal:latest",
    region: "bom1",
    resources: Object.freeze({ vcpus: 1 }),
    timeout: MAX_TIMEOUT_MS,
    persistent: false,
    networkPolicy: "deny-all",
    ports: Object.freeze([]),
  });
}

export function validateWorkspaceFiles(files) {
  if (!Array.isArray(files) || files.length < 1 || files.length > MAX_FILES) {
    throw new Error("A workspace submission must contain 1–100 files.");
  }

  const seen = new Set();
  let totalBytes = 0;
  const validated = files.map((file) => {
    const path = validateWorkspacePath(file?.path);
    if (seen.has(path)) throw new Error("A workspace submission cannot contain duplicate paths.");
    seen.add(path);
    if (typeof file?.content !== "string") throw new Error("Workspace file content must be text.");
    const bytes = new TextEncoder().encode(file.content).byteLength;
    if (bytes > MAX_FILE_BYTES) throw new Error("Each workspace file must be 1 MB or smaller.");
    totalBytes += bytes;
    if (totalBytes > MAX_TOTAL_FILE_BYTES) throw new Error("A workspace submission cannot exceed 3 MB.");
    return Object.freeze({ path, content: file.content, bytes });
  });

  return Object.freeze(validated);
}

export function validateSandboxCommand({ command, args = [], timeout = MAX_TIMEOUT_MS }) {
  if (typeof command !== "string" || !ALLOWED_EXECUTABLES.has(command)) {
    throw new Error("This executable is not allowed in Aahana's build workspace.");
  }
  if (!Array.isArray(args) || args.length > MAX_ARGUMENTS ||
      args.some((arg) => typeof arg !== "string" || arg.length > MAX_ARGUMENT_LENGTH || arg.includes("\0"))) {
    throw new Error("Invalid command arguments.");
  }
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > MAX_TIMEOUT_MS) {
    throw new Error("Command timeout exceeds the workspace limit.");
  }
  if (command === "npm" && !ALLOWED_NPM_COMMANDS.has(args[0])) {
    throw new Error("This npm operation is not permitted.");
  }
  if (command === "npm" && ["install", "ci"].includes(args[0]) &&
      (!args.includes("--ignore-scripts") || args.some((arg) => arg.startsWith("--ignore-scripts=")))) {
    throw new Error("Dependency installation must disable package lifecycle scripts.");
  }

  return Object.freeze({ command, args: [...args], timeout, sudo: false });
}

export function assertHumanApprovalRequired(action) {
  if (!AUTOMATED_ACTIONS.has(action)) {
    throw new Error("This action requires owner approval outside the sandbox.");
  }
  return true;
}


const SAFE_PACKAGE_VERSION = /^(?:[\^~]|>=|<=|>|<)?[0-9]+[.][0-9]+[.][0-9]+(?:-[0-9A-Za-z.-]+)?(?:[+][0-9A-Za-z.-]+)?$/;
const SAFE_PACKAGE_NAME = /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i;

export function validatePackageManifest(files) {
  const packageFile = files.find((file) => file.path === "package.json");
  if (!packageFile) return Object.freeze({ manifest: null, hasDependencies: false });

  let manifest;
  try {
    manifest = JSON.parse(packageFile.content);
  } catch {
    throw new Error("package.json must contain valid JSON.");
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("package.json must contain a JSON object.");
  }

  const scripts = manifest.scripts && typeof manifest.scripts === "object" && !Array.isArray(manifest.scripts)
    ? manifest.scripts
    : {};
  for (const hook of ["preinstall", "install", "postinstall", "prepare"]) {
    if (Object.hasOwn(scripts, hook)) {
      throw new Error("Install lifecycle scripts are not permitted in the isolated build workspace.");
    }
  }

  if (manifest.overrides || manifest.workspaces) {
    throw new Error("Package overrides and workspaces are not permitted in the isolated build workspace.");
  }

  let dependencyCount = 0;
  let hasDependencies = false;
  for (const groupName of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    const group = manifest[groupName];
    if (group === undefined) continue;
    if (!group || typeof group !== "object" || Array.isArray(group)) {
      throw new Error("Package dependency declarations must be objects.");
    }
    for (const [name, version] of Object.entries(group)) {
      dependencyCount += 1;
      if (dependencyCount > 200 || !SAFE_PACKAGE_NAME.test(name) ||
          typeof version !== "string" || !SAFE_PACKAGE_VERSION.test(version)) {
        throw new Error("Only registry packages with explicit semantic-version ranges are permitted.");
      }
      hasDependencies = true;
    }
  }

  return Object.freeze({ manifest, hasDependencies });
}
