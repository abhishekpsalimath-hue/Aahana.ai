import test from "node:test";
import assert from "node:assert/strict";
import { executeBuildTask } from "./build-engine.mjs";

function createFakeSandbox({ installExitCode = 0, taskExitCode = 0 } = {}) {
  const calls = [];
  const sandbox = {
    async writeFiles(files) {
      calls.push({ type: "writeFiles", files });
    },
    async update(options) {
      calls.push({ type: "update", options });
    },
    async runCommand(options) {
      calls.push({ type: "runCommand", options });
      const isInstall = options.cmd === "npm" && options.args[0] === "install";
      return {
        exitCode: isInstall ? installExitCode : taskExitCode,
        async stdout() { return isInstall ? "installed\n" : "task output\n"; },
        async stderr() { return isInstall && installExitCode ? "install failed\n" : ""; },
      };
    },
    async stop() {
      calls.push({ type: "stop" });
    },
  };
  return { sandbox, calls, SandboxClient: { async create(options) {
    calls.push({ type: "create", options });
    return sandbox;
  } } };
}

test("runs a simple JavaScript entrypoint in a disposable deny-all sandbox", async () => {
  const fake = createFakeSandbox();
  const result = await executeBuildTask({
    files: [{ path: "src/main.js", content: "console.log('hello')" }],
    operation: "run",
    entrypoint: "src/main.js",
    projectId: "prj_12345678",
    sandboxName: "aahana-build-test-123",
    SandboxClient: fake.SandboxClient,
  });

  assert.equal(result.status, "passed");
  assert.equal(result.exitCode, 0);
  assert.equal(fake.calls[0].options.networkPolicy, "deny-all");
  assert.equal(fake.calls[0].options.persistent, false);
  assert.equal(fake.calls[0].options.resources.vcpus, 1);
  assert.equal(fake.calls.at(-1).type, "stop");
  assert.equal(fake.calls.some((call) => call.type === "update"), true);
});

test("installs registry dependencies only while egress is allow-listed", async () => {
  const fake = createFakeSandbox();
  const result = await executeBuildTask({
    files: [
      {
        path: "package.json",
        content: JSON.stringify({
          dependencies: { react: "^19.1.0" },
          scripts: { build: "node build.js" },
        }),
      },
      { path: "build.js", content: "console.log('built')" },
    ],
    operation: "build",
    projectId: "prj_12345678",
    sandboxName: "aahana-build-test-456",
    SandboxClient: fake.SandboxClient,
  });

  assert.equal(result.status, "passed");
  const updates = fake.calls.filter((call) => call.type === "update");
  assert.deepEqual(updates.map((call) => call.options.networkPolicy), [
    { allow: ["registry.npmjs.org"] },
    "deny-all",
    "deny-all",
  ]);
  const commands = fake.calls.filter((call) => call.type === "runCommand");
  assert.deepEqual(commands.map((call) => call.options.args[0]), ["install", "run"]);
  assert.ok(commands[0].options.args.includes("--ignore-scripts"));
  assert.ok(commands[0].options.args.includes("--package-lock=false"));
});

test("does not run project scripts when dependency installation fails", async () => {
  const fake = createFakeSandbox({ installExitCode: 1 });
  const result = await executeBuildTask({
    files: [
      {
        path: "package.json",
        content: JSON.stringify({
          dependencies: { react: "^19.1.0" },
          scripts: { build: "node build.js" },
        }),
      },
      { path: "build.js", content: "throw new Error('must not run')" },
    ],
    operation: "build",
    projectId: "prj_12345678",
    sandboxName: "aahana-build-test-789",
    SandboxClient: fake.SandboxClient,
  });

  assert.equal(result.status, "failed");
  assert.equal(fake.calls.filter((call) => call.type === "runCommand").length, 1);
  assert.equal(fake.calls.at(-1).type, "stop");
});

test("rejects an entrypoint that was not submitted", async () => {
  const fake = createFakeSandbox();
  await assert.rejects(() => executeBuildTask({
    files: [{ path: "src/main.js", content: "console.log('hello')" }],
    operation: "run",
    entrypoint: "../secret.js",
    projectId: "prj_12345678",
    sandboxName: "aahana-build-test-000",
    SandboxClient: fake.SandboxClient,
  }));
  assert.equal(fake.calls.length, 0);
});

test("requires an explicit build or test script", async () => {
  const fake = createFakeSandbox();
  await assert.rejects(() => executeBuildTask({
    files: [{ path: "package.json", content: JSON.stringify({}) }],
    operation: "test",
    projectId: "prj_12345678",
    sandboxName: "aahana-build-test-111",
    SandboxClient: fake.SandboxClient,
  }));
  assert.equal(fake.calls.length, 0);
});


test("keeps the sandbox disposable and closes it after a failed project command", async () => {
  const fake = createFakeSandbox({ taskExitCode: 1 });
  const result = await executeBuildTask({
    files: [{ path: "src/main.js", content: "throw new Error('expected failure')" }],
    operation: "run",
    entrypoint: "src/main.js",
    projectId: "prj_12345678",
    sandboxName: "aahana-build-test-222",
    SandboxClient: fake.SandboxClient,
  });

  assert.equal(result.status, "failed");
  assert.equal(result.exitCode, 1);
  assert.equal(fake.calls.filter((call) => call.type === "stop").length, 1);
  assert.equal(fake.calls.at(-1).type, "stop");
  assert.equal(fake.calls.filter((call) => call.type === "update").at(-1).options.networkPolicy, "deny-all");
});


test("stops the disposable sandbox when registry egress cannot be enabled", async () => {
  const calls = [];
  const sandbox = {
    async writeFiles(files) { calls.push({ type: "writeFiles", files }); },
    async update(options) {
      calls.push({ type: "update", options });
      if (options.networkPolicy && typeof options.networkPolicy === "object") {
        throw new Error("registry egress policy unavailable");
      }
    },
    async runCommand(options) {
      calls.push({ type: "runCommand", options });
      return { exitCode: 0, async stdout() { return ""; }, async stderr() { return ""; } };
    },
    async stop() { calls.push({ type: "stop" }); },
  };
  const SandboxClient = { async create(options) {
    calls.push({ type: "create", options });
    return sandbox;
  } };

  await assert.rejects(() => executeBuildTask({
    files: [
      { path: "package.json", content: JSON.stringify({
        dependencies: { react: "^19.1.0" },
        scripts: { build: "node build.js" },
      }) },
      { path: "build.js", content: "console.log('must not run')" },
    ],
    operation: "build",
    projectId: "prj_12345678",
    sandboxName: "aahana-build-egress-123",
    SandboxClient,
  }), /registry egress policy unavailable/);

  assert.equal(calls.filter((call) => call.type === "runCommand").length, 0);
  assert.equal(calls.filter((call) => call.type === "stop").length, 1);
  assert.equal(calls.at(-1).type, "stop");
});

test("stops the sandbox when workspace upload fails before any command can run", async () => {
  const calls = [];
  const sandbox = {
    async writeFiles() { calls.push("writeFiles"); throw new Error("upload failed"); },
    async update() { calls.push("update"); },
    async runCommand() { calls.push("runCommand"); return { exitCode: 0, async stdout() { return ""; }, async stderr() { return ""; } }; },
    async stop() { calls.push("stop"); },
  };
  const SandboxClient = { async create() { calls.push("create"); return sandbox; } };

  await assert.rejects(() => executeBuildTask({
    files: [{ path: "src/main.js", content: "console.log('hello')" }],
    operation: "run",
    entrypoint: "src/main.js",
    projectId: "prj_12345678",
    sandboxName: "aahana-build-upload-failure",
    SandboxClient,
  }), /upload failed/);

  assert.deepEqual(calls, ["create", "writeFiles", "update", "stop"]);
  assert.equal(calls.includes("runCommand"), false);
});


test("aborts and stops the isolated sandbox when the caller disconnects", async () => {
  const controller = new AbortController();
  let signalRunStarted;
  const runStarted = new Promise((resolve) => { signalRunStarted = resolve; });
  let stopCount = 0;
  const sandbox = {
    async writeFiles() {},
    async update() {},
    async runCommand() {
      signalRunStarted();
      return new Promise((resolve, reject) => {
        controller.signal.addEventListener("abort", () => reject(new Error("sandbox command aborted")), { once: true });
      });
    },
    async stop() {
      stopCount += 1;
      controller.abort();
    },
  };
  const SandboxClient = { async create() { return sandbox; } };
  const task = executeBuildTask({
    files: [{ path: "src/main.js", content: "console.log('hello')" }],
    operation: "run",
    entrypoint: "src/main.js",
    projectId: "prj_12345678",
    sandboxName: "aahana-build-cancel-123",
    SandboxClient,
    signal: controller.signal,
  });

  await runStarted;
  controller.abort();
  await assert.rejects(task, /sandbox command aborted/);
  assert.equal(stopCount, 1);
});

test("does not create a sandbox when the caller is already disconnected", async () => {
  const controller = new AbortController();
  controller.abort();
  let createCount = 0;
  const SandboxClient = { async create() { createCount += 1; throw new Error("must not create"); } };

  await assert.rejects(() => executeBuildTask({
    files: [{ path: "src/main.js", content: "console.log('hello')" }],
    operation: "run",
    entrypoint: "src/main.js",
    projectId: "prj_12345678",
    sandboxName: "aahana-build-cancel-456",
    SandboxClient,
    signal: controller.signal,
  }), /Build cancelled before sandbox creation/);
  assert.equal(createCount, 0);
});
