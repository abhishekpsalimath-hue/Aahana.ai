import test from "node:test";
import assert from "node:assert/strict";
import { createCreatorDraft } from "./creator-studio-model.mjs";
import { createCreatorWorkspaceDocument, readCreatorWorkspaceDocument } from "./creator-workspace-model.mjs";

test("wraps a Creator Studio draft in the shared project schema", () => {
  const draft = createCreatorDraft("2026-11-18T00:00:00.000Z");
  const document = createCreatorWorkspaceDocument(draft, "9d3f22b1-07f3-4d82-88f2-89bbd4e8e555");
  assert.equal(document.schema, "aahana-creator-workspace/v1");
  assert.equal(document.project.schema, "aahana-project/v1");
  assert.equal(document.project.scenes[0].title, draft.scenes[0].title);
});

test("preserves shared assets and scene work when the learning brief is edited", () => {
  const draft = createCreatorDraft();
  const projectId = "9d3f22b1-07f3-4d82-88f2-89bbd4e8e555";
  const initial = createCreatorWorkspaceDocument(draft, projectId);
  const withAsset = {
    ...initial.project,
    assets: [{ id: "asset-1", kind: "image", name: "Planet", mimeType: "image/png", size: 500, storageKey: "aahana-studio-assets/user/planet.png" }],
  };
  const updated = createCreatorWorkspaceDocument({ ...draft, title: "Solar system" }, projectId, withAsset);
  assert.equal(updated.project.assets.length, 1);
  assert.equal(updated.project.title, "Solar system");
});

test("reads current and legacy cloud documents safely", () => {
  const draft = createCreatorDraft();
  const document = createCreatorWorkspaceDocument(draft, "9d3f22b1-07f3-4d82-88f2-89bbd4e8e555");
  assert.equal(readCreatorWorkspaceDocument(document).draft.title, draft.title);
  assert.equal(readCreatorWorkspaceDocument(draft).project, null);
  assert.equal(readCreatorWorkspaceDocument({ invalid: true }), null);
});
