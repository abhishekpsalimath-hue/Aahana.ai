import test from "node:test";
import assert from "node:assert/strict";
import { HUMAN_KNOWLEDGE_DEPTH_GUIDANCE, getKnowledgeDepthGuidance } from "./knowledge-domain-guidance.mjs";

test("core assistant knowledge spans humanities, arts, and sciences", () => {
  const guidance = getKnowledgeDepthGuidance("solve").join(" ");
  for (const domain of ["history", "archaeology", "anthropology", "philosophy", "literature", "sculpture", "architecture", "music", "cinema", "mathematics", "physics", "biology", "astronomy", "engineering"]) {
    assert.match(guidance, new RegExp(domain, "i"), domain);
  }
});

test("knowledge guidance encourages depth, evidence, and cross-disciplinary reasoning", () => {
  const guidance = getKnowledgeDepthGuidance("improve").join(" ");
  assert.match(guidance, /primary evidence/i);
  assert.match(guidance, /interdisciplinary/i);
  assert.match(guidance, /causes, mechanisms, context, consequences/i);
  assert.match(guidance, /never fabricate/i);
});

test("Student Mode receives no new knowledge layer", () => {
  assert.deepEqual(getKnowledgeDepthGuidance("learn"), []);
  assert.equal(getKnowledgeDepthGuidance("solve").length, HUMAN_KNOWLEDGE_DEPTH_GUIDANCE.length);
});

test("returned guidance cannot mutate the shared guidance list", () => {
  const first = getKnowledgeDepthGuidance("solve");
  first.pop();
  assert.equal(getKnowledgeDepthGuidance("solve").length, HUMAN_KNOWLEDGE_DEPTH_GUIDANCE.length);
});
