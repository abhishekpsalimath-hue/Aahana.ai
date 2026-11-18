import test from "node:test";
import assert from "node:assert/strict";
import { CORE_KNOWLEDGE_INSTRUCTIONS } from "./core-knowledge-instructions.mjs";

test("Core Assistant knowledge standard spans major technical, creative and practical fields", () => {
  for (const term of ["mathematics", "medicine", "climate science", "business", "software engineering", "AI", "architecture", "VFX", "3D", "everyday practical skills"]) {
    assert.ok(CORE_KNOWLEDGE_INSTRUCTIONS.toLowerCase().includes(term.toLowerCase()), term);
  }
});

test("Core Assistant knowledge standard requires evidence, reasoning and honest uncertainty", () => {
  assert.match(CORE_KNOWLEDGE_INSTRUCTIONS, /primary and official sources/);
  assert.match(CORE_KNOWLEDGE_INSTRUCTIONS, /check units and arithmetic/);
  assert.match(CORE_KNOWLEDGE_INSTRUCTIONS, /Never claim omniscience, perfect accuracy/);
});
