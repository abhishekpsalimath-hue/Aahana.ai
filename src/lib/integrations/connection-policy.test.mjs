import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeIntegrationConnection,
  isIntegrationActionAllowed,
} from "./connection-policy.mjs";

test("integration connections remain disconnected until granted scopes cover requested scopes", () => {
  const connection = normalizeIntegrationConnection({
    providerId: "google-drive",
    state: "connected",
    requestedScopes: ["files.read", "files.write"],
    grantedScopes: ["files.read"],
  });
  assert.equal(connection.connected, false);
  assert.equal(connection.state, "pending");
  assert.deepEqual(connection.missingScopes, ["files.write"]);
});

test("connection metadata is normalized and contains no credential fields", () => {
  const connection = normalizeIntegrationConnection({
    providerId: "github",
    state: "connected",
    accountLabel: "  Founder workspace  ",
    requestedScopes: ["repo.read"],
    grantedScopes: ["repo.read", "repo.read"],
    accessToken: "must-never-be-returned",
    refreshToken: "must-never-be-returned",
  });
  assert.equal(connection.connected, true);
  assert.equal(connection.accountLabel, "Founder workspace");
  assert.deepEqual(connection.grantedScopes, ["repo.read"]);
  assert.equal("accessToken" in connection, false);
  assert.equal("refreshToken" in connection, false);
  assert.equal(connection.secretStorage, "server_only");
  assert.equal(connection.externalActionsAllowed, false);
});

test("external integration actions require fresh user approval for each action", () => {
  const connection = normalizeIntegrationConnection({
    providerId: "calendar",
    state: "connected",
    requestedScopes: ["events.read"],
    grantedScopes: ["events.read"],
  });
  assert.equal(isIntegrationActionAllowed(connection, { actionId: "create-event" }), false);
  assert.equal(isIntegrationActionAllowed(connection, { actionId: "create-event", freshUserApproval: true }), true);
  assert.equal(isIntegrationActionAllowed(connection, { freshUserApproval: true }), false);
});

test("invalid provider IDs fail closed", () => {
  assert.throws(() => normalizeIntegrationConnection({ providerId: "../secrets" }), /provider ID/);
});
