import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildImageEditPrompt } from "@/lib/creative/creative-director.mjs";
import { getReferenceImageDimensions, isReferenceImageWithinProviderBounds, parseImageEditInput } from "@/lib/creative/image-generation.mjs";
import { detectImageMimeTypeFromBase64 } from "@/lib/creative/image-provider.mjs";
import { readBoundedImageEditRequest } from "@/lib/creative/bounded-image-edit-request.mjs";
import { readBoundedImageProviderJson } from "@/lib/creative/bounded-image-generation-json.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "@cf/black-forest-labs/flux-2-klein-4b";

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in to edit an image." }, { status: 401 });
  }

  if (process.env.AAHANA_IMAGE_EDITING_ENABLED !== "true") {
    return NextResponse.json({ error: "Reference-based image editing is not enabled in this environment yet." }, { status: 503 });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    return NextResponse.json({ error: "Image editing is not connected in the private server settings." }, { status: 503 });
  }

  const parsedRequest = await readBoundedImageEditRequest(request);
  if (!parsedRequest.ok) {
    return NextResponse.json({ error: parsedRequest.error }, { status: parsedRequest.status });
  }
  const { image, prompt: editInstruction, referencePrompt } = parsedRequest;

  const imageBytes = new Uint8Array(await image.arrayBuffer());
  const dimensions = getReferenceImageDimensions(imageBytes, image.type);
  if (!isReferenceImageWithinProviderBounds(dimensions)) {
    return NextResponse.json({ error: "The reference image must be smaller than 512 × 512 pixels. Please retry with a smaller image." }, { status: 400 });
  }
  if (request.signal.aborted) return NextResponse.json({ error: "Image editing cancelled." }, { status: 499 });
  const prompt = buildImageEditPrompt(referencePrompt, editInstruction);
  if (!prompt) return NextResponse.json({ error: "Describe the change you want to make." }, { status: 400 });
  const providerForm = new FormData();
  providerForm.set("prompt", prompt);
  providerForm.set("input_image_0", new Blob([imageBytes], { type: image.type }), "reference-image");
  providerForm.set("width", "1024");
  providerForm.set("height", "1024");

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${MODEL}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiToken}` },
        body: providerForm,
        cache: "no-store",
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(55000)]),
      }
    );

    if (request.signal.aborted) return NextResponse.json({ error: "Image editing cancelled." }, { status: 499 });
    const parsedProviderResponse = await readBoundedImageProviderJson(response);
    const result = parsedProviderResponse.ok ? parsedProviderResponse.value : null;
    if (request.signal.aborted) return NextResponse.json({ error: "Image editing cancelled." }, { status: 499 });
    const imageBase64 = result?.result?.image;
    const imageMimeType = detectImageMimeTypeFromBase64(imageBase64);
    if (!response.ok || !imageMimeType) {
      const providerStatus = response.status;
      const status = providerStatus === 429 ? 429 : providerStatus >= 500 ? 503 : 502;
      console.error("Aahana reference image edit failed:", {
        status: providerStatus,
        providerError: result?.errors?.[0]?.message || "No valid edited image returned",
      });
      const message = providerStatus === 429
        ? "The image-editing service has reached its current usage limit. Please try again later."
        : "Aahana could not apply that change to the image. Please try a clearer instruction.";
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json(
      { imageDataUrl: `data:${imageMimeType};base64,${imageBase64}`, model: MODEL },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (request.signal.aborted || error?.name === "AbortError") {
      return NextResponse.json({ error: "Image editing cancelled." }, { status: 499 });
    }
    console.error("Aahana reference image edit request failed:", error?.name || "unknown error");
    return NextResponse.json({ error: "Image editing timed out or the provider is unavailable. Please try again." }, { status: 503 });
  }
}
