import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspaceCheckPlan } from "./workspace-check-plan-policy.mjs";

test("prepares install, build and test commands from a bounded Node manifest", () => {
  const plan = createWorkspaceCheckPlan([
    {
      path: "package.json",
      content: JSON.stringify({
        dependencies: { next: "^16.0.0" },
        scripts: { build: "next build", test: "node --test" },
      }),
    },
    { path: "package-lock.json", content: "{}" },
  ]);
  assert.equal(plan.available, true);
  assert.equal(plan.installRequired, true);
  assert.equal(plan.lockfileUsed, true);
  assert.deepEqual(plan.commands.map((item) => item.args[0]), ["ci", "run", "run"]);
  assert.equal(plan.commands[0].args.includes("--ignore-scripts"), true);
  assert.equal(plan.commands[0].args.includes("--registry=https://registry.npmjs.org"), true);
  assert.equal(plan.commands[1].args[1], "build");
  assert.equal(plan.commands[2].args[1], "test");
  assert.equal(plan.executionApproved, false);
});

test("uses npm install without a lockfile and omits absent scripts", () => {
  const plan = createWorkspaceCheckPlan([{
    path: "package.json",
    content: JSON.stringify({
      devDependencies: { vitest: "~3.0.0" },
      scripts: { lint: "eslint ." },
    }),
  }]);
  assert.equal(plan.lockfileUsed, false);
  assert.equal(plan.commands.length, 1);
  assert.equal(plan.commands[0].args[0], "install");
  assert.equal(plan.commands.some((item) => item.args[1] === "lint"), false);
});

test("reports no automatic Node checks when package.json is absent", () => {
  const plan = createWorkspaceCheckPlan([{ path: "main.py", content: "print('hi')" }]);
  assert.equal(plan.available, false);
  assert.equal(plan.commands.length, 0);
});

test("rejects unsafe package lifecycle scripts and unsupported dependency declarations", () => {
  assert.throws(() => createWorkspaceCheckPlan([{
    path: "package.json",
    content: JSON.stringify({ scripts: { postinstall: "node setup.js" } }),
  }]), /lifecycle scripts/);
  assert.throws(() => createWorkspaceCheckPlan([{
    path: "package.json",
    content: JSON.stringify({ dependencies: { next: "latest" } }),
  }]), /semantic-version ranges/);
});
