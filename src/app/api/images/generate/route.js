import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseImageGenerationInput } from "@/lib/creative/image-generation.mjs";
import { readBoundedImageGenerationJson, readBoundedImageProviderJson } from "@/lib/creative/bounded-image-generation-json.mjs";
import { resolveImageModel, DEFAULT_IMAGE_MODEL, ACCURACY_IMAGE_MODEL, ENHANCED_IMAGE_MODEL, buildImageProviderRequest, detectImageMimeTypeFromBase64, supportsImageAspectRatio } from "@/lib/creative/image-provider.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  const parsedBody = await readBoundedImageGenerationJson(request);
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  }
  const body = parsedBody.value;
  const input = parseImageGenerationInput(body);
  if (!input.ok) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }
  const { prompt, steps, width, height, aspectRatio } = input;

  try {
    const model = resolveImageModel(process.env.AAHANA_IMAGE_MODEL);
    if (!supportsImageAspectRatio(model, aspectRatio)) {
      return NextResponse.json({ error: "The current default image model supports square output only. Portrait and landscape ratios require a FLUX.2 image model." }, { status: 400 });
    }
    const seed = Number.isInteger(body?.seed) && body.seed >= 0 && body.seed <= 0xffffffff ? body.seed : undefined;
    const providerRequest = buildImageProviderRequest({ model, prompt, steps, seed, width, height });
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`,
      {
        ...providerRequest,
        headers: {
          ...providerRequest.headers,
          Authorization: `Bearer ${apiToken}`,
        },
        cache: "no-store",
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(55000)]),
      }
    );

    if (request.signal.aborted) {
      return NextResponse.json({ error: "Image generation cancelled." }, { status: 499 });
    }
    const parsedProviderResponse = await readBoundedImageProviderJson(response);
    if (request.signal.aborted) {
      return NextResponse.json({ error: "Image generation cancelled." }, { status: 499 });
    }
    const result = parsedProviderResponse.ok ? parsedProviderResponse.value : null;
    const image = result?.result?.image;
    const imageMimeType = detectImageMimeTypeFromBase64(image);
    if (!response.ok || !imageMimeType) {
      const providerStatus = response.status;
      const status = providerStatus === 429 ? 429 : providerStatus >= 500 ? 503 : 502;
      console.error("Aahana image provider request failed:", { status: providerStatus, providerError: result?.errors?.[0]?.message || "No valid image returned" });
      let message = "Aahana could not generate that image. Please try again.";
      if (providerStatus === 401) message = "Cloudflare rejected the image-generation API token. Check the CLOUDFLARE_API_TOKEN setting in Vercel.";
      else if (providerStatus === 403) message = "The Cloudflare token does not have permission to use Workers AI. Update its Workers AI permissions.";
      else if (providerStatus === 429) message = "The image-generation service has reached its current usage limit. Please try again after it resets.";
      else if (providerStatus === 400) message = "The image service could not accept this prompt. Try a shorter or clearer description.";
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json(
      { imageDataUrl: `data:${imageMimeType};base64,${image}`, model, steps: model === ENHANCED_IMAGE_MODEL ? 4 : model === ACCURACY_IMAGE_MODEL ? 25 : steps, width, height, aspectRatio },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (request.signal.aborted || error?.name === "AbortError") {
      return NextResponse.json({ error: "Image generation cancelled." }, { status: 499 });
    }
    console.error("Aahana image generation request failed:", error?.name || "unknown error");
    return NextResponse.json({ error: "Image generation timed out or the provider is unavailable. Please try again." }, { status: 503 });
  }
}
