import test from "node:test";
import assert from "node:assert/strict";
import {
  assertHumanApprovalRequired,
  createSafeSandboxOptions,
  validateSandboxCommand,
  validateWorkspaceFiles,
  validateWorkspacePath,
} from "./sandbox-policy.mjs";

test("accepts ordinary relative project paths", () => {
  assert.equal(validateWorkspacePath("src/components/Planet.jsx"), "src/components/Planet.jsx");
});

test("rejects traversal, absolute paths and Windows separators", () => {
  for (const path of ["../.env", "src/../../secret", "/etc/passwd", "C:\\secret", "src\\file.js", "src/\u0000file.js", "src/\u001b[31mfile.js", "src/\u202efile.js"]) {
    assert.throws(() => validateWorkspacePath(path));
  }
});

test("rejects secret and runtime-managed directories", () => {
  for (const path of [".env", ".env.production", ".git/config", ".next/cache", "node_modules/pkg/index.js", "src/.npmrc"]) {
    assert.throws(() => validateWorkspacePath(path));
  }
});

test("creates a least-privilege sandbox configuration", () => {
  const config = createSafeSandboxOptions({
    name: "aahana-build-user123",
    projectId: "prj_Ts4f4dcI3IPvBOw5IWPdsfmumbHK",
  });
  assert.equal(config.networkPolicy, "deny-all");
  assert.equal(config.persistent, false);
  assert.deepEqual(config.resources, { vcpus: 1 });
  assert.deepEqual(config.ports, []);
  assert.equal("env" in config, false);
  assert.equal("source" in config, false);
  assert.equal("projectId" in config, false);
});

test("rejects invalid sandbox identifiers", () => {
  assert.throws(() => createSafeSandboxOptions({ name: "bad name", projectId: "prj_123" }));
  assert.throws(() => createSafeSandboxOptions({ name: "aahana-build-123456", projectId: "production" }));
});

test("bounds workspace files and rejects duplicates or oversized content", () => {
  const files = validateWorkspaceFiles([{ path: "src/main.js", content: "console.log('safe')" }]);
  assert.equal(files.length, 1);
  assert.equal(files[0].path, "src/main.js");
  assert.throws(() => validateWorkspaceFiles([
    { path: "src/main.js", content: "a" },
    { path: "src/main.js", content: "b" },
  ]));
  assert.throws(() => validateWorkspaceFiles([{ path: "large.txt", content: "x".repeat(1024 * 1024 + 1) }]));
  assert.throws(() => validateWorkspaceFiles(Array.from({ length: 101 }, (_, i) => ({ path: `src/${i}.js`, content: "" }))));
});

test("allows bounded read/build commands", () => {
  assert.deepEqual(
    validateSandboxCommand({ command: "npm", args: ["install", "--ignore-scripts"] }),
    { command: "npm", args: ["install", "--ignore-scripts"], timeout: 120000, sudo: false },
  );
  assert.equal(validateSandboxCommand({ command: "node", args: ["src/main.js"] }).sudo, false);
});

test("blocks privileged, remote and unbounded commands", () => {
  assert.throws(() => validateSandboxCommand({ command: "bash", args: ["-lc", "rm -rf /"] }));
  assert.throws(() => validateSandboxCommand({ command: "npm", args: ["install"] }));
  assert.throws(() => validateSandboxCommand({ command: "npm", args: ["install", "--ignore-scripts=false"] }));
  assert.throws(() => validateSandboxCommand({ command: "git", args: ["push", "origin", "main"] }));
  assert.throws(() => validateSandboxCommand({ command: "npm", args: ["publish"] }));
  assert.throws(() => validateSandboxCommand({ command: "node", args: [], timeout: 120001 }));
});

test("protected release actions always require owner approval", () => {
  for (const action of ["merge", "production-deploy", "database-migration", "secret-change", "auth-policy-change", "security-policy-change", "release-permission-change"]) {
    assert.throws(() => assertHumanApprovalRequired(action));
  }
  assert.equal(assertHumanApprovalRequired("create-preview"), true);
  assert.throws(() => assertHumanApprovalRequired("unknown-action"));
  assert.throws(() => assertHumanApprovalRequired("git-push"));
});


test("accepts only registry-backed semantic-version dependencies", () => {
  const files = [{
    path: "package.json",
    content: JSON.stringify({
      dependencies: { react: "^19.1.0", three: "~0.180.0" },
      devDependencies: { eslint: "9.35.0" },
      scripts: { build: "next build", test: "node --test" },
    }),
  }];
  const result = validatePackageManifest(files);
  assert.equal(result.hasDependencies, true);
  assert.equal(result.manifest.scripts.build, "next build");
});

test("rejects remote, local, alias and non-semver dependency sources", () => {
  for (const version of [
    "https://example.com/pkg.tgz",
    "git+https://github.com/user/repo.git",
    "file:../local-package",
    "workspace:*",
    "npm:other-package@^1.0.0",
    "latest",
  ]) {
    assert.throws(() => validatePackageManifest([{
      path: "package.json",
      content: JSON.stringify({ dependencies: { example: version } }),
    }]));
  }
});

test("rejects package install lifecycle scripts", () => {
  for (const hook of ["preinstall", "install", "postinstall", "prepare"]) {
    assert.throws(() => validatePackageManifest([{
      path: "package.json",
      content: JSON.stringify({ scripts: { [hook]: "node malicious.js" } }),
    }]));
  }
});

test("accepts workspaces without package dependencies", () => {
  const result = validatePackageManifest([{
    path: "package.json",
    content: JSON.stringify({ scripts: { build: "node build.js" } }),
  }]);
  assert.equal(result.hasDependencies, false);
});
