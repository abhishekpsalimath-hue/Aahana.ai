import test from "node:test";
import assert from "node:assert/strict";
import { resolveAiProviderConfig } from "./provider-policy.mjs";

test("defaults to Groq and its configured free model", () => {
  const config = resolveAiProviderConfig({ GROQ_API_KEY: "server-groq-key" });
  assert.equal(config.ok, true);
  assert.equal(config.provider, "groq");
  assert.equal(config.model, "openai/gpt-oss-120b");
  assert.equal(config.apiKey, "server-groq-key");
  assert.match(config.endpoint, /api\.groq\.com/);
});

test("uses only server environment credentials for Vercel AI Gateway", () => {
  const config = resolveAiProviderConfig({
    AAHANA_AI_PROVIDER: "vercel",
    AAHANA_MODEL: "openai/gpt-4.1-nano",
    AI_GATEWAY_API_KEY: "server-gateway-key",
    VERCEL_OIDC_TOKEN: "server-oidc-token",
  });
  assert.equal(config.ok, true);
  assert.equal(config.apiKey, "server-gateway-key");
  assert.match(config.endpoint, /ai-gateway\.vercel\.sh/);
});

test("supports server OIDC only when no gateway API key is configured", () => {
  const config = resolveAiProviderConfig({
    AAHANA_AI_PROVIDER: "vercel",
    AAHANA_MODEL: "openai/gpt-4.1-nano",
    VERCEL_OIDC_TOKEN: "server-oidc-token",
  });
  assert.equal(config.apiKey, "server-oidc-token");
});

test("fails closed for unknown providers and missing credentials", () => {
  assert.equal(resolveAiProviderConfig({ AAHANA_AI_PROVIDER: "unknown" }).error, "unsupported-provider");
  assert.equal(resolveAiProviderConfig({ AAHANA_AI_PROVIDER: "vercel", AAHANA_MODEL: "model" }).error, "missing-credentials");
  assert.equal(resolveAiProviderConfig({ AAHANA_AI_PROVIDER: "groq" }).error, "missing-credentials");
});
