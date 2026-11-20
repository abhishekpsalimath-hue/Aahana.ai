import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildImagePrompt } from "@/lib/creative/creative-director.mjs";
import { parseImageEditInput } from "@/lib/creative/image-generation.mjs";

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

  let form;
  try { form = await request.formData(); } catch {
    return NextResponse.json({ error: "Invalid image-edit request." }, { status: 400 });
  }

  const image = form.get("image");
  const input = parseImageEditInput({
    prompt: form.get("prompt"),
    imageType: image?.type,
    imageSize: image?.size,
  });
  if (!input.ok || !(image instanceof File)) {
    return NextResponse.json({ error: input.error || "Attach a valid reference image." }, { status: 400 });
  }

  const prompt = buildImagePrompt(input.prompt);
  const providerForm = new FormData();
  providerForm.set("prompt", prompt);
  providerForm.set("input_image_0", new Blob([await image.arrayBuffer()], { type: image.type }), "reference-image");
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
        signal: AbortSignal.timeout(55000),
      }
    );

    const result = await response.json().catch(() => null);
    const imageBase64 = result?.result?.image;
    if (!response.ok || typeof imageBase64 !== "string" || !imageBase64) {
      const providerStatus = response.status;
      const status = providerStatus === 429 ? 429 : providerStatus >= 500 ? 503 : 502;
      console.error("Aahana reference image edit failed:", {
        status: providerStatus,
        providerError: result?.errors?.[0]?.message || "No edited image returned",
      });
      const message = providerStatus === 429
        ? "The image-editing service has reached its current usage limit. Please try again later."
        : "Aahana could not apply that change to the image. Please try a clearer instruction.";
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json(
      { imageDataUrl: `data:image/jpeg;base64,${imageBase64}`, model: MODEL },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Aahana reference image edit request failed:", error?.name || "unknown error");
    return NextResponse.json({ error: "Image editing timed out or the provider is unavailable. Please try again." }, { status: 503 });
  }
}
