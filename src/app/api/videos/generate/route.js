import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  validateVideoGenerationInput,
  isTrustedGeneratedVideoUrl,
} from "@/lib/ai/video-generation-policy.mjs";

export const runtime = "nodejs";
export const maxDuration = 180;

const VIDEO_MODEL = "black-forest-labs/flux-3-video";

function extractVideoUrl(payload) {
  const candidates = [
    payload?.result?.result?.video,
    payload?.result?.video,
    payload?.video,
  ];
  return candidates.find((value) => typeof value === "string" && value.length > 0) || null;
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in to generate a video." }, { status: 401 });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    return NextResponse.json({
      error: "Video generation is not connected. Configure the private Cloudflare Workers AI account ID and API token.",
    }, { status: 503 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid video request." }, { status: 400 });
  }

  let input;
  try {
    input = validateVideoGenerationInput({
      prompt: body?.prompt,
      duration: body?.duration ?? 5,
      resolution: body?.resolution ?? "hd",
      aspectRatio: body?.aspectRatio ?? "16:9",
      generateAudio: body?.generateAudio ?? true,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Invalid video settings." }, { status: 400 });
  }

  try {
    const response = await fetch(
      "https://api.cloudflare.com/client/v4/accounts/" + encodeURIComponent(accountId) + "/ai/run",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + apiToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: VIDEO_MODEL,
          input: {
            mode: "t2v",
            prompt: input.prompt,
            resolution: input.resolution,
            aspect_ratio: input.aspectRatio,
            duration: input.duration,
            generate_audio: input.generateAudio,
          },
        }),
        cache: "no-store",
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(165000)]),
      },
    );

    const result = await response.json().catch(() => null);
    const videoUrl = extractVideoUrl(result);
    if (!response.ok || result?.success === false || !isTrustedGeneratedVideoUrl(videoUrl)) {
      const providerStatus = response.status;
      console.error("Aahana video provider request failed:", {
        status: providerStatus,
        providerError: result?.errors?.[0]?.message || "No trusted video URL returned",
      });
      let message = "Aahana could not generate that video. Please try again.";
      if (providerStatus === 401) message = "Cloudflare rejected the video-generation API token. Check CLOUDFLARE_API_TOKEN.";
      else if (providerStatus === 403) message = "The Cloudflare token does not have permission to use this video model.";
      else if (providerStatus === 429) message = "The video-generation service is busy or has reached its usage limit. Try again later.";
      else if (providerStatus === 400) message = "The video service could not accept this request. Try a simpler prompt or shorter duration.";
      else if (providerStatus === 402) message = "The video provider requires available credits or billing to be enabled.";
      return NextResponse.json({ error: message }, { status: providerStatus === 429 ? 429 : providerStatus >= 500 ? 503 : 502 });
    }

    return NextResponse.json({
      videoUrl,
      model: VIDEO_MODEL,
      duration: input.duration,
      resolution: input.resolution,
      generatedAudio: input.generateAudio,
      expiresIn: "The provider's signed video URL is temporary; save the video promptly.",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (request.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    console.error("Aahana video generation request failed:", error?.name || "unknown error");
    return NextResponse.json({
      error: "Video generation timed out or the provider is unavailable. Please try again.",
    }, { status: 503 });
  }
}
