import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  IMAGE_WORKFLOW_LIMITS,
  isAllowedPrompt,
  isSafeProviderImageUrl,
  parseGuardVerdict,
  parseImageDataUrl,
  parseVisualSafetyVerdict,
} from "@/lib/ai/image-workflow.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;

const EDIT_MODEL = "black-forest-labs/flux-3-image-klein";
const UPSCALE_MODEL = "topaz/gigapixel-high-fidelity-3";
const GUARD_MODEL = "@cf/meta/llama-guard-3-8b";
const VISION_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

async function runCloudflare(accountId, apiToken, model, input, timeoutMs = 45000) {
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
  if (!response.ok || payload?.success === false || !payload?.result) {
    const status = response.status === 429 ? 429 : response.status >= 500 ? 503 : 502;
    throw Object.assign(new Error("An image service could not complete the request."), { status });
  }
  return payload.result;
}

async function moderatePrompt(accountId, apiToken, prompt) {
  const result = await runCloudflare(accountId, apiToken, GUARD_MODEL, {
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    max_tokens: 128,
  }, 9000);
  const verdict = parseGuardVerdict(result.response || result.result || result);
  if (!verdict) throw new Error("Prompt safety could not be verified.");
  if (!verdict.safe) throw Object.assign(new Error("This image request is not allowed by Aahana's image safety rules."), { status: 400 });
}

async function moderateImage(accountId, apiToken, imageDataUrl) {
  const result = await runCloudflare(accountId, apiToken, VISION_MODEL, {
    messages: [{
      role: "user",
      content: [
        {
          type: "text",
          text: 'Review this image for image-safety policy. Return only JSON: {"safe":true|false,"reason":"short reason"}. Mark unsafe if it contains nudity, explicit or sexualized content, sexual activity, sexualized depictions of minors, or sexualized content where the subject's age is ambiguous, exploitation, graphic violence, or other clearly harmful prohibited imagery. Do not mark ordinary non-sexual family, medical, educational, or artistic imagery unsafe solely because of context. If uncertain, return safe:false.',
        },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ],
    }],
    temperature: 0,
    max_tokens: 160,
  }, 11000);
  const verdict = parseVisualSafetyVerdict(result.response || result.result || "");
  if (!verdict) throw new Error("Image safety could not be verified.");
  if (!verdict.safe) throw Object.assign(new Error("This image cannot be processed because it did not pass Aahana's image safety check."), { status: 400 });
}

async function getProviderImageDataUrl(url) {
  if (!isSafeProviderImageUrl(url)) throw new Error("The image provider returned an untrusted image URL.");
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error("The processed image could not be retrieved.");
  const contentType = response.headers.get("content-type")?.split(";")[0]?.toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) throw new Error("The image provider returned an unsupported format.");
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > IMAGE_WORKFLOW_LIMITS.outputMaxBytes) throw new Error("The processed image is too large to return.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > IMAGE_WORKFLOW_LIMITS.outputMaxBytes) throw new Error("The processed image is too large to return.");
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Please sign in to process an image." }, { status: 401 });

  if (process.env.AAHANA_IMAGE_WORKFLOWS_ENABLED !== "true" || process.env.AAHANA_IMAGE_SAFETY_ENABLED !== "true") {
    return NextResponse.json({
      error: "Image editing and enhancement are not enabled yet. Safety checks and provider billing must be configured first.",
    }, { status: 503 });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) return NextResponse.json({ error: "The image service is not connected." }, { status: 503 });

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid image request." }, { status: 400 });
  }

  const action = body?.action;
  const parsedImage = parseImageDataUrl(body?.imageDataUrl);
  if (!parsedImage) return NextResponse.json({ error: "Choose a PNG, JPEG or WebP image up to 2 MB." }, { status: 400 });
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (action === "edit" && !isAllowedPrompt(prompt)) {
    return NextResponse.json({ error: "Describe the edit in 1–2,048 characters." }, { status: 400 });
  }
  if (action !== "edit" && action !== "enhance") {
    return NextResponse.json({ error: "Choose image editing or 4K enhancement." }, { status: 400 });
  }

  try {
    const inputDataUrl = `data:${parsedImage.mimeType};base64,${parsedImage.base64}`;
    const checks = [moderateImage(accountId, apiToken, inputDataUrl)];
    if (action === "edit") checks.push(moderatePrompt(accountId, apiToken, prompt));
    await Promise.all(checks);

    let result;
    if (action === "edit") {
      result = await runCloudflare(accountId, apiToken, EDIT_MODEL, {
        prompt: `Apply only the requested changes: ${prompt}\nPreserve the original subject identity, count, pose, framing, composition, background, lighting, colors, and all details not explicitly requested to change. Do not add text, objects, people, logos, or watermarks.`,
        images: [inputDataUrl],
        resolution: "1k",
      }, 32000);
    } else {
      result = await runCloudflare(accountId, apiToken, UPSCALE_MODEL, {
        image: inputDataUrl,
        output_width: 3840,
        output_format: "jpeg",
        recovery_strength: 0.65,
        opacity: 0.85,
        face_enhancement: false,
      }, 32000);
    }

    const imageUrl = result.image || result.sample;
    if (typeof imageUrl !== "string") throw new Error("The image provider returned no processed image.");
    const imageDataUrl = await getProviderImageDataUrl(imageUrl);
    await moderateImage(accountId, apiToken, imageDataUrl);

    return NextResponse.json(
      { imageDataUrl, action, model: action === "edit" ? EDIT_MODEL : UPSCALE_MODEL, originalPreserved: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 503;
    if (status >= 500) console.error("Aahana image workflow failed:", error?.message || "unknown error");
    return NextResponse.json({ error: error?.message || "Image processing failed. Please try again." }, { status });
  }
}
