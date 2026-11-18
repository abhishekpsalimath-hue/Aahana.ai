import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { IMAGE_PROMPT_COMPILER_INSTRUCTIONS, selectCompiledImagePrompt } from "@/lib/ai/image-prompt-compiler.mjs";
import { parseGuardVerdict, parseVisualSafetyVerdict } from "@/lib/ai/image-workflow.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "@cf/black-forest-labs/flux-1-schnell";
const MAX_PROMPT_LENGTH = 2048;

const GUARD_MODEL = "@cf/meta/llama-guard-3-8b";
const VISION_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

async function runSafetyModel(accountId, apiToken, model, input, timeoutMs) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    }
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false || !payload?.result) throw new Error("Image safety service is unavailable.");
  return payload.result;
}

async function moderateImagePrompt(accountId, apiToken, prompt) {
  const result = await runSafetyModel(accountId, apiToken, GUARD_MODEL, {
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    max_tokens: 128,
  }, 12000);
  const verdict = parseGuardVerdict(result.response || result.result || result);
  if (!verdict) throw new Error("Image prompt safety could not be verified.");
  if (!verdict.safe) throw Object.assign(new Error("This image request is not allowed by Aahana's image safety rules."), { status: 400 });
}

async function moderateGeneratedImage(accountId, apiToken, imageDataUrl) {
  const result = await runSafetyModel(accountId, apiToken, VISION_MODEL, {
    messages: [{
      role: "user",
      content: [
        {
          type: "text",
          text: 'Review this image for image-safety policy. Return only JSON: {"safe":true|false,"reason":"short reason"}. Mark unsafe if it contains nudity, explicit or sexualized content, sexual activity, sexualized minors or age ambiguity, exploitation, graphic violence, or other clearly harmful prohibited imagery. Do not mark ordinary non-sexual family, medical, educational, or artistic imagery unsafe solely because of context. If uncertain, return safe:false.',
        },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ],
    }],
    temperature: 0,
    max_tokens: 160,
  }, 18000);
  const verdict = parseVisualSafetyVerdict(result.response || result.result || "");
  if (!verdict) throw new Error("Generated image safety could not be verified.");
  if (!verdict.safe) throw Object.assign(new Error("The generated image did not pass Aahana's image safety check."), { status: 400 });
}

async function refineImagePrompt(originalPrompt) {
  const provider = (process.env.AAHANA_AI_PROVIDER || "groq").toLowerCase();
  const apiKey = process.env.GROQ_API_KEY;
  if (provider !== "groq" || !apiKey) return { prompt: originalPrompt, refined: false };

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.AAHANA_MODEL || "openai/gpt-oss-120b",
        temperature: 0.2,
        max_completion_tokens: 650,
        stream: false,
        messages: [
          { role: "system", content: IMAGE_PROMPT_COMPILER_INSTRUCTIONS },
          { role: "user", content: JSON.stringify({ user_image_request: originalPrompt }) },
        ],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) {
      console.warn("Aahana image prompt refinement skipped:", { status: response.status });
      return { prompt: originalPrompt, refined: false };
    }
    const payload = await response.json().catch(() => null);
    const candidate = payload?.choices?.[0]?.message?.content;
    const compiled = selectCompiledImagePrompt(candidate, originalPrompt);
    return { prompt: compiled, refined: compiled !== originalPrompt };
  } catch (error) {
    console.warn("Aahana image prompt refinement skipped:", error?.name || "unknown error");
    return { prompt: originalPrompt, refined: false };
  }
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in to generate an image." }, { status: 401 });
  }

  if (process.env.AAHANA_IMAGE_SAFETY_ENABLED !== "true") {
    return NextResponse.json({ error: "Image generation is paused until prompt and output safety checks are enabled." }, { status: 503 });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    return NextResponse.json({
      error: "Image generation is not connected yet. Add the Cloudflare Workers AI account ID and API token in the private server settings."
    }, { status: 503 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json({ error: "Describe the image in 1–2,048 characters." }, { status: 400 });
  }

  try {
    await moderateImagePrompt(accountId, apiToken, prompt);
    const { prompt: finalPrompt, refined } = await refineImagePrompt(prompt);
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${MODEL}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: finalPrompt, steps: 8 }),
        cache: "no-store",
        signal: AbortSignal.timeout(50000),
      }
    );

    const result = await response.json().catch(() => null);
    const image = result?.result?.image;
    if (!response.ok || !image) {
      const providerStatus = response.status;
      const status = providerStatus === 429 ? 429 : providerStatus >= 500 ? 503 : 502;
      console.error("Aahana image provider request failed:", { status: providerStatus, providerError: result?.errors?.[0]?.message || "No image returned" });
      let message = "Aahana could not generate that image. Please try again.";
      if (providerStatus === 401) message = "Cloudflare rejected the image-generation API token. Check the CLOUDFLARE_API_TOKEN setting in Vercel.";
      else if (providerStatus === 403) message = "The Cloudflare token does not have permission to use Workers AI. Update its Workers AI permissions.";
      else if (providerStatus === 429) message = "The image-generation service has reached its current usage limit. Please try again after it resets.";
      else if (providerStatus === 400) message = "The image service could not accept this prompt. Try a shorter or clearer description.";
      return NextResponse.json({ error: message }, { status });
    }

    const imageDataUrl = `data:image/jpeg;base64,${image}`;
    await moderateGeneratedImage(accountId, apiToken, imageDataUrl);
    return NextResponse.json(
      { imageDataUrl, model: MODEL, promptRefined: refined, safetyChecked: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 503;
    if (status >= 500) console.error("Aahana image generation request failed:", error?.name || "unknown error");
    return NextResponse.json({ error: error?.message || "Image generation timed out or the provider is unavailable. Please try again." }, { status });
  }
}
