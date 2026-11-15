import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "@cf/black-forest-labs/flux-1-schnell";
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
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json({ error: "Describe the image in 1–2,048 characters." }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${MODEL}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt, steps: 4 }),
        cache: "no-store",
        signal: AbortSignal.timeout(55000),
      }
    );

    const result = await response.json().catch(() => null);
    const image = result?.result?.image;
    if (!response.ok || !image) {
      const status = response.status === 429 ? 429 : response.status >= 500 ? 503 : 502;
      console.error("Aahana image provider request failed:", { status: response.status, providerError: result?.errors?.[0]?.message || "No image returned" });
      return NextResponse.json({
        error: response.status === 429
          ? "The free image-generation limit is temporarily reached. Please try again after it resets."
          : "Aahana could not generate that image. Please try again with a simpler prompt."
      }, { status });
    }

    return NextResponse.json(
      { imageDataUrl: `data:image/jpeg;base64,${image}`, model: MODEL },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Aahana image generation request failed:", error?.name || "unknown error");
    return NextResponse.json({ error: "Image generation timed out or the provider is unavailable. Please try again." }, { status: 503 });
  }
}
