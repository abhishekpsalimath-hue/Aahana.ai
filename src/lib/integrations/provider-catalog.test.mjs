import test from "node:test";
import assert from "node:assert/strict";
import {
  getIntegrationProvider,
  listIntegrationProviders,
} from "./provider-catalog.mjs";

test("integration catalogue lists known providers as planned, not falsely connected", () => {
  const providers = listIntegrationProviders();
  assert.deepEqual(
    providers.map((provider) => provider.id),
    ["google-drive", "gmail", "google-calendar", "github", "slack", "notion"],
  );
  for (const provider of providers) {
    assert.equal(provider.status, "planned");
    assert.equal(provider.externalActionsEnabled, false);
    assert.equal(provider.requiresFreshApproval, true);
  }
});

test("provider scopes are least-privilege metadata and returned arrays cannot mutate the catalogue", () => {
  const first = getIntegrationProvider("gmail");
  assert.deepEqual(first.requestedScopes, ["gmail.readonly", "gmail.compose"]);
  first.requestedScopes.push("mail.full_access");
  assert.deepEqual(getIntegrationProvider("gmail").requestedScopes, ["gmail.readonly", "gmail.compose"]);
});

test("integration catalogue can filter by category and rejects unknown providers", () => {
  assert.deepEqual(listIntegrationProviders({ category: "calendar" }).map((item) => item.id), ["google-calendar"]);
  assert.deepEqual(listIntegrationProviders({ category: "unknown" }), []);
  assert.equal(getIntegrationProvider("unknown"), null);
});
