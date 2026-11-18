/**
 * Resolve AI credentials exclusively from server-side environment variables.
 * Never accept provider credentials from browser-controlled request headers.
 */
export function resolveAiProviderConfig(env = process.env) {
  const provider = String(env.AAHANA_AI_PROVIDER || "groq").trim().toLowerCase();
  if (!["groq", "vercel"].includes(provider)) {
    return { ok: false, error: "unsupported-provider", provider };
  }
  const isGroq = provider === "groq";
  const configuredKey = isGroq
    ? env.GROQ_API_KEY
    : (env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN);
  const apiKey = typeof configuredKey === "string" ? configuredKey.trim() : "";
  const configuredModel = env.AAHANA_MODEL || (isGroq ? "openai/gpt-oss-120b" : "");
  const model = typeof configuredModel === "string" ? configuredModel.trim() : "";
  if (!apiKey || !model) {
    return { ok: false, error: "missing-credentials", provider };
  }
  return Object.freeze({
    ok: true,
    provider,
    isGroq,
    apiKey,
    model,
    endpoint: isGroq
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://ai-gateway.vercel.sh/v1/chat/completions",
  });
}
