import test from "node:test";
import assert from "node:assert/strict";
import { buildCreatorExport, createCreatorDraft, CREATOR_VISUAL_TYPES, validateCreatorDraft } from "./creator-studio-model.mjs";

test("new creator draft starts with one editable scene and draft status", () => {
  const draft = createCreatorDraft("2026-11-17T00:00:00.000Z");
  assert.equal(draft.status, "draft");
  assert.equal(draft.scenes.length, 1);
  assert.equal(draft.scenes[0].visualType, "motion-scene");
});

test("validates and bounds lesson metadata and scene content", () => {
  const draft = createCreatorDraft();
  draft.title = "Solar System";
  draft.subject = "Science";
  draft.objective = "Understand planetary motion";
  draft.scenes[0].title = "Meet the Sun";
  draft.scenes[0].narration = "The Sun is a star.";
  const result = validateCreatorDraft(draft);
  assert.equal(result.title, "Solar System");
  assert.equal(result.scenes[0].narration, "The Sun is a star.");
});

test("rejects missing titles, empty scenes and excessive scene counts", () => {
  const draft = createCreatorDraft();
  assert.equal(validateCreatorDraft({ ...draft, title: "" }), null);
  assert.equal(validateCreatorDraft({ ...draft, scenes: [] }), null);
  assert.equal(validateCreatorDraft({ ...draft, scenes: Array.from({ length: 31 }, (_, i) => ({ id: String(i), title: "Scene" })) }), null);
});

test("unknown visual types safely fall back to a supported visual type", () => {
  const draft = createCreatorDraft();
  draft.scenes[0].title = "Scene";
  draft.scenes[0].visualType = "unverified-renderer";
  assert.equal(validateCreatorDraft(draft).scenes[0].visualType, "diagram");
  assert.deepEqual(CREATOR_VISUAL_TYPES, ["diagram", "3d-model", "motion-scene", "knowledge-check"]);
});

test("exports an explicit draft artifact and never labels it published", () => {
  const draft = createCreatorDraft();
  draft.title = "Fractions";
  draft.scenes[0].title = "Parts of a whole";
  const artifact = buildCreatorExport(draft);
  assert.equal(artifact.format, "aahana-learning-studio");
  assert.equal(artifact.publishing.status, "not-published");
  assert.match(artifact.publishing.note, /not been published/i);
});

test("refuses to export an invalid draft", () => {
  assert.throws(() => buildCreatorExport({ title: "", scenes: [] }), /incomplete or invalid/);
});
