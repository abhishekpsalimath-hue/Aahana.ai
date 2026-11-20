import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseVideoGenerationInput, VIDEO_MODEL } from "@/lib/creative/video-generation.mjs";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in to generate a video." }, { status: 401 });
  }

  // This paid third-party model remains unavailable until explicitly enabled by the owner.
  if (process.env.AAHANA_VIDEO_GENERATION_ENABLED !== "true") {
    return NextResponse.json({ error: "Video generation is not enabled yet. No generation was started." }, { status: 503 });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    return NextResponse.json({ error: "The video provider is not configured in private server settings." }, { status: 503 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid video request." }, { status: 400 });
  }
  const input = parseVideoGenerationInput(body);
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: VIDEO_MODEL,
          input: {
            prompt: input.prompt,
            duration: input.duration,
            aspect_ratio: input.aspectRatio,
            resolution: input.resolution,
          },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(160000),
      }
    );

    const result = await response.json().catch(() => null);
    const videoUrl = result?.result?.video;
    if (!response.ok || typeof videoUrl !== "string") {
      const providerStatus = response.status;
      const status = providerStatus === 429 ? 429 : providerStatus >= 500 ? 503 : 502;
      console.error("Aahana video provider request failed:", {
        status: providerStatus,
        providerError: result?.errors?.[0]?.message || "No video returned",
      });
      return NextResponse.json({
        error: providerStatus === 429
          ? "The video service has reached its current usage limit. Please try again later."
          : "Aahana could not generate that video. Please try again.",
      }, { status });
    }

    let parsedUrl;
    try { parsedUrl = new URL(videoUrl); } catch {
      return NextResponse.json({ error: "The video provider returned an invalid video address." }, { status: 502 });
    }
    if (parsedUrl.protocol !== "https:") {
      return NextResponse.json({ error: "The video provider returned an insecure video address." }, { status: 502 });
    }

    return NextResponse.json({
      videoUrl: parsedUrl.toString(),
      model: VIDEO_MODEL,
      duration: input.duration,
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Aahana video generation request failed:", error?.name || "unknown error");
    return NextResponse.json({ error: "Video generation timed out or the provider is unavailable. Please try again." }, { status: 503 });
  }
}
