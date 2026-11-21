import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_IMAGE_UPSCALE_OUTPUT_BYTES,
  getSafeImageUpscaleWorkerUrl,
  validateImageUpscaleInput,
} from "@/lib/creative/image-upscale.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in to enhance an image." }, { status: 401 });
  }

  if (process.env.AAHANA_IMAGE_UPSCALE_ENABLED !== "true") {
    return NextResponse.json({ error: "4K image enhancement is not enabled in this environment yet." }, { status: 503 });
  }

  const workerUrl = getSafeImageUpscaleWorkerUrl(process.env.AAHANA_IMAGE_UPSCALE_WORKER_URL);
  const workerSecret = process.env.AAHANA_UPSCALE_SHARED_SECRET;
  if (!workerUrl || !workerSecret) {
    return NextResponse.json({ error: "Image enhancement is not connected in the private server settings." }, { status: 503 });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid image-enhancement request." }, { status: 400 });
  }

  const image = form.get("image");
  if (!(image instanceof File) || image.size < 1) {
    return NextResponse.json({ error: "Attach an image to enhance." }, { status: 400 });
  }
  if (image.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "Images must be 20 MB or smaller." }, { status: 413 });
  }

  let imageBytes;
  try {
    imageBytes = new Uint8Array(await image.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Could not read the attached image." }, { status: 400 });
  }
  const validation = validateImageUpscaleInput(imageBytes, image.type);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 415 });
  }

  try {
    const workerResponse = await fetch(workerUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${workerSecret}`,
        "Content-Type": validation.mimeType,
      },
      body: imageBytes,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(55000),
    });

    if (!workerResponse.ok) {
      const status = workerResponse.status === 429 ? 429 : workerResponse.status >= 500 ? 503 : 502;
      console.error("Aahana image upscale Worker failed:", { status: workerResponse.status });
      return NextResponse.json({
        error: workerResponse.status === 429
          ? "Image enhancement is temporarily rate-limited. Please try again later."
          : "Aahana could not enhance this image right now. Please try again.",
      }, { status });
    }

    const outputType = (workerResponse.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
    if (outputType !== "image/png") {
      return NextResponse.json({ error: "The image enhancement service returned an unsupported format." }, { status: 502 });
    }

    const outputBytes = new Uint8Array(await workerResponse.arrayBuffer());
    if (outputBytes.length < 8 || outputBytes.length > MAX_IMAGE_UPSCALE_OUTPUT_BYTES) {
      return NextResponse.json({ error: "The enhanced image could not be validated." }, { status: 502 });
    }
    const outputSignature = outputBytes.subarray(0, 8);
    if (outputSignature[0] !== 0x89 || outputSignature[1] !== 0x50 ||
        outputSignature[2] !== 0x4e || outputSignature[3] !== 0x47 ||
        outputSignature[4] !== 0x0d || outputSignature[5] !== 0x0a ||
        outputSignature[6] !== 0x1a || outputSignature[7] !== 0x0a) {
      return NextResponse.json({ error: "The enhanced image could not be validated." }, { status: 502 });
    }

    return NextResponse.json(
      { imageDataUrl: `data:image/png;base64,${Buffer.from(outputBytes).toString("base64")}` },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Aahana image upscale request failed:", error?.name || "unknown error");
    return NextResponse.json({ error: "Image enhancement timed out or the service is unavailable. Please try again." }, { status: 503 });
  }
}
