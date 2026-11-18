import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildImageEditPrompt, parseImageEditInput } from "@/lib/studio/image-edit.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "@cf/runwayml/stable-diffusion-v1-5-img2img";
const STYLES = new Set(["cartoon", "anime", "comic", "3d-animation", "watercolor"]);

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in to edit an image." }, { status: 401 });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    return NextResponse.json({
      error: "Image editing is not connected yet. Add the Cloudflare Workers AI account ID and API token in private server settings."
    }, { status: 503 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid image-edit request." }, { status: 400 });
  }

  const image = parseImageEditInput(body?.imageDataUrl);
  if (!image) {
    return NextResponse.json({ error: "Upload a PNG, JPEG or WebP image smaller than 4 MB." }, { status: 400 });
  }

  const style = STYLES.has(body?.style) ? body.style : "cartoon";
  const requestedStrength = Number(body?.strength);
  const strength = Number.isFinite(requestedStrength)
    ? Math.max(0.2, Math.min(0.65, requestedStrength))
    : 0.38;
  const prompt = buildImageEditPrompt(style);

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${MODEL}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          negative_prompt: "sticker, die-cut sticker, white outline, emoji, chibi, mascot, avatar, different person, different face, face swap, altered identity, extra person, extra limbs, distorted face, text, watermark, logo, blurry, low quality",
          image_b64: image.base64,
          strength,
          num_steps: 20,
          guidance: 7.5,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(55000),
      }
    );

    const result = await response.json().catch(() => null);
    const outputImage = result?.result?.image || result?.result?.images?.[0];
    if (!response.ok || typeof outputImage !== "string" || !outputImage) {
      const providerStatus = response.status;
      const status = providerStatus === 429 ? 429 : providerStatus >= 500 ? 503 : 502;
      console.error("Aahana image-edit provider failed:", {
        status: providerStatus,
        providerError: result?.errors?.[0]?.message || "No edited image returned",
      });
      let message = "Aahana could not transform this photo. Please try again.";
      if (providerStatus === 401) message = "Cloudflare rejected the image-editing API token. Check the private server configuration.";
      else if (providerStatus === 403) message = "The Cloudflare token does not have permission to use Workers AI.";
      else if (providerStatus === 429) message = "The image-editing service is busy or has reached its usage limit. Please try again later.";
      else if (providerStatus === 400) message = "The image-editing service could not process this photo. Try a smaller PNG, JPEG or WebP image.";
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json(
      { imageDataUrl: `data:image/png;base64,${outputImage}`, model: MODEL, style, strength },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Aahana image-edit request failed:", error?.name || "unknown error");
    return NextResponse.json({ error: "Image editing timed out or the provider is unavailable. Please try again." }, { status: 503 });
  }
}
