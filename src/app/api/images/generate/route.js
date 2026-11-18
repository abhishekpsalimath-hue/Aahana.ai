import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const GENERATION_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const EDIT_MODEL = "@cf/black-forest-labs/flux-1-kontext-pro";
const MAX_INPUT_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_PROMPT_LENGTH = 2048;

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in to generate an image." }, { status: 401 });
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
  const inputImage = typeof body?.inputImage === "string" ? body.inputImage : null;
  const imageMatch = inputImage?.match(/^data:(image\\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json({ error: "Describe the image in 1–2,048 characters." }, { status: 400 });
  }

  if (inputImage && (!imageMatch || Math.floor(imageMatch[2].length * 3 / 4) > MAX_INPUT_IMAGE_BYTES)) {
    return NextResponse.json({ error: "Attach a PNG, JPEG or WebP image up to 2 MB to edit it." }, { status: 400 });
  }

  const model = imageMatch ? EDIT_MODEL : GENERATION_MODEL;
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(imageMatch
          ? { prompt, input_image: imageMatch[2], output_format: "jpeg" }
          : { prompt, steps: 4 }),
        cache: "no-store",
        signal: AbortSignal.timeout(55000),
      }
    );

    const result = await response.json().catch(() => null);
    let image = result?.result?.image;
    if (typeof image === "string" && /^https:\\/\\//i.test(image)) {
      try {
        const imageResponse = await fetch(image, { cache: "no-store", signal: AbortSignal.timeout(15000) });
        const contentType = imageResponse.headers.get("content-type") || "";
        const bytes = await imageResponse.arrayBuffer();
        if (imageResponse.ok && /^image\\/(?:jpeg|png|webp)$/i.test(contentType) && bytes.byteLength <= 10 * 1024 * 1024) {
          image = Buffer.from(bytes).toString("base64");
        } else image = null;
      } catch { image = null; }
    }
    if (!response.ok || typeof image !== "string" || !/^[A-Za-z0-9+/=]+$/.test(image)) {
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

    return NextResponse.json(
      { imageDataUrl: `data:image/jpeg;base64,${image}`, model, edited: Boolean(imageMatch) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Aahana image generation request failed:", error?.name || "unknown error");
    return NextResponse.json({ error: "Image generation timed out or the provider is unavailable. Please try again." }, { status: 503 });
  }
}
