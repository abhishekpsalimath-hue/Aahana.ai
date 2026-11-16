import test from "node:test";
import assert from "node:assert/strict";
import {
  EXECUTIVE_ROLES,
  buildExecutiveSystemPrompt,
  getExecutiveRole,
} from "./roles.mjs";

test("only the four supported executive roles resolve", () => {
  assert.deepEqual(Object.keys(EXECUTIVE_ROLES).sort(), ["ceo", "cmo", "coo", "cto"]);
  assert.equal(getExecutiveRole(" CTO ").id, "cto");
  assert.equal(getExecutiveRole("chief-finance-officer"), null);
  assert.equal(getExecutiveRole(null), null);
});

test("executives remain non-executing; only the CEO can coordinate internal specialists", () => {
  for (const role of Object.values(EXECUTIVE_ROLES)) {
    assert.equal(role.permissions.read, true);
    assert.equal(role.permissions.draft, true);
    assert.equal(role.permissions.execute, false);
  }
  assert.equal(EXECUTIVE_ROLES.ceo.permissions.delegate, true);
  for (const id of ["cto", "coo", "cmo"]) assert.equal(EXECUTIVE_ROLES[id].permissions.delegate, false);
});

test("role prompt includes role scope and common safety boundaries", () => {
  const prompt = buildExecutiveSystemPrompt("cmo", { projectName: "Aahana" });
  assert.match(prompt, /Chief Marketing Officer/);
  assert.match(prompt, /Never invent customers, testimonials, partnerships/);
  assert.match(prompt, /do not have permission to execute external actions/);
  assert.match(prompt, /Authorised project context label: Aahana/);
});

test("unknown roles fail closed", () => {
  assert.throws(() => buildExecutiveSystemPrompt("admin"), /Unknown executive role/);
});

test("project label is bounded and does not grant access", () => {
  const prompt = buildExecutiveSystemPrompt("ceo", { projectName: "x".repeat(500) });
  assert.match(prompt, /does not grant access to project data/);
  assert.ok(prompt.length < 3000);
});
