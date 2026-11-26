import test from "node:test";
import assert from "node:assert/strict";
import { listVideoProviders, resolveVideoProvider, validateVideoProviderRequest, VIDEO_PROVIDER_IDS } from "./video-provider-registry.mjs";

test("exposes only the implemented provider and its verified capability limits", () => {
  const providers = listVideoProviders();
  assert.equal(providers.length, 1);
  assert.equal(providers[0].id, VIDEO_PROVIDER_IDS.CLOUDFLARE_GROK_IMAGINE);
  assert.equal(providers[0].model, "xai/grok-imagine-video");
  assert.equal(providers[0].capabilities.maxDurationSeconds, 15);
  assert.deepEqual(providers[0].capabilities.resolutions, ["480p", "720p"]);
  assert.equal(providers[0].capabilities.audioGeneration, false);
  assert.equal(providers[0].capabilities.multiShotNative, false);
});

test("returns defensive capability copies to callers", () => {
  const providers = listVideoProviders();
  providers[0].capabilities.resolutions.push("8k");
  assert.deepEqual(listVideoProviders()[0].capabilities.resolutions, ["480p", "720p"]);
});

test("defaults to the existing provider without changing the current model", () => {
  const result = resolveVideoProvider();
  assert.equal(result.ok, true);
  assert.equal(result.provider.model, "xai/grok-imagine-video");
});

test("fails closed for unknown providers and malformed ids", () => {
  assert.equal(resolveVideoProvider("unverified-provider").ok, false);
  assert.equal(resolveVideoProvider({}).ok, false);
});

test("validates duration, aspect ratio, resolution and image-to-video support", () => {
  const provider = resolveVideoProvider().provider;
  const valid = { prompt: "A cinematic city", duration: 5, aspectRatio: "16:9", resolution: "480p" };
  assert.deepEqual(validateVideoProviderRequest(provider, valid), { ok: true });
  assert.equal(validateVideoProviderRequest(provider, { ...valid, duration: 16 }).ok, false);
  assert.equal(validateVideoProviderRequest(provider, { ...valid, aspectRatio: "21:9" }).ok, false);
  assert.equal(validateVideoProviderRequest(provider, { ...valid, resolution: "1080p" }).ok, false);
  assert.equal(validateVideoProviderRequest(provider, { ...valid, hasReferenceImage: true }).ok, true);
  assert.equal(validateVideoProviderRequest(null, valid).ok, false);
});
