import test from "node:test";
import assert from "node:assert/strict";
import { HUMAN_KNOWLEDGE_DEPTH_GUIDANCE, getKnowledgeDepthGuidance } from "./knowledge-domain-guidance.mjs";

const NON_STUDENT_MODES = ["solve", "create", "write", "build", "improve"];

test("core assistant knowledge spans humanities, arts, and sciences", () => {
  const guidance = getKnowledgeDepthGuidance("solve").join(" ");
  for (const domain of [
    "history", "archaeology", "anthropology", "philosophy", "literature",
    "sculpture", "architecture", "music", "cinema", "textiles", "material culture",
    "mathematics", "physics", "biology", "astronomy", "engineering",
  ]) {
    assert.match(guidance, new RegExp(domain, "i"), domain);
  }
});

test("guidance teaches evidence-aware and discipline-aware reasoning", () => {
  const guidance = getKnowledgeDepthGuidance("improve").join(" ");
  for (const phrase of [
    /primary evidence/i,
    /interdisciplinary/i,
    /causes, mechanisms, context, consequences/i,
    /direct influence from resemblance/i,
    /correlation from causation/i,
    /competing positions/i,
    /never fabricate/i,
  ]) assert.match(guidance, phrase);
});

test("every ordinary assistant mode receives the knowledge layer", () => {
  for (const mode of NON_STUDENT_MODES) {
    assert.equal(getKnowledgeDepthGuidance(mode).length, HUMAN_KNOWLEDGE_DEPTH_GUIDANCE.length, mode);
  }
});

test("Student Mode receives no new knowledge layer", () => {
  assert.deepEqual(getKnowledgeDepthGuidance("learn"), []);
});

test("each call returns an isolated array and cannot mutate shared guidance", () => {
  for (const mode of NON_STUDENT_MODES) {
    const first = getKnowledgeDepthGuidance(mode);
    first.pop();
    assert.equal(getKnowledgeDepthGuidance(mode).length, HUMAN_KNOWLEDGE_DEPTH_GUIDANCE.length, mode);
  }
});
