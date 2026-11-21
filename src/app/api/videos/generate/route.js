import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseVideoGenerationInput, readVideoRequestWithinLimit, MAX_VIDEO_IMAGE_BYTES, MAX_VIDEO_MULTIPART_BYTES, VIDEO_MODEL } from "@/lib/creative/video-generation.mjs";
import { detectImageMimeTypeFromBase64 } from "@/lib/creative/image-provider.mjs";

export const runtime = "nodejs";
export const maxDuration = 180;

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in to generate a video." }, { status: 401 });
  }

  // Paid video inference is owner-gated and disabled until explicitly approved.
  if (process.env.AAHANA_VIDEO_GENERATION_ENABLED !== "true") {
    return NextResponse.json({ error: "Video generation is not enabled yet. No generation was started." }, { status: 503 });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    return NextResponse.json({ error: "The video provider is not configured in private server settings." }, { status: 503 });
  }

  const contentType = request.headers.get("Content-Type") || "";
  if (!/^multipart\/form-data;\s*boundary=/i.test(contentType)) {
    return NextResponse.json({ error: "Attach an image using the supported video request form." }, { status: 400 });
  }
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_VIDEO_MULTIPART_BYTES) {
    return NextResponse.json({ error: "Video requests must be 2 MB or smaller." }, { status: 413 });
  }
  const requestBytes = await readVideoRequestWithinLimit(request.body);
  if (!requestBytes) {
    return NextResponse.json({ error: "Video request exceeds the 2 MB upload limit or could not be read." }, { status: 413 });
  }

  let input;
  let imageFile = null;
  try {
    const boundedRequest = new Request("https://aahana.internal/video-generation", {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: requestBytes,
    });
    const form = await boundedRequest.formData();
    input = parseVideoGenerationInput({
      prompt: form.get("prompt"),
      duration: Number(form.get("duration")),
      aspectRatio: form.get("aspectRatio"),
      resolution: form.get("resolution"),
    });
    imageFile = form.get("image");
  } catch {
    return NextResponse.json({ error: "Invalid video request." }, { status: 400 });
  }
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

  if (imageFile && (typeof imageFile.arrayBuffer !== "function" ||
      !ALLOWED_IMAGE_TYPES.has(imageFile.type) || imageFile.size < 1 || imageFile.size > MAX_VIDEO_IMAGE_BYTES)) {
    return NextResponse.json({ error: "Choose a PNG, JPEG or WebP image up to 2 MB." }, { status: 400 });
  }

  let imageBytes = null;
  if (imageFile) {
    try { imageBytes = Buffer.from(await imageFile.arrayBuffer()); } catch {
      return NextResponse.json({ error: "The reference image could not be read." }, { status: 400 });
    }
    const detectedType = detectImageMimeTypeFromBase64(imageBytes.toString("base64"));
    if (detectedType !== imageFile.type) {
      return NextResponse.json({ error: "The reference image content does not match its declared file type." }, { status: 400 });
    }
  }

  let temporaryObjectPath = null;
  try {
    const providerInput = {
      prompt: input.prompt,
      duration: input.duration,
      aspect_ratio: input.aspectRatio,
      resolution: input.resolution,
    };

    if (imageFile) {
      const extension = imageFile.type === "image/png" ? "png" : imageFile.type === "image/webp" ? "webp" : "jpg";
      temporaryObjectPath = `${user.id}/personal/video-input-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("aahana-private").upload(
        temporaryObjectPath, imageBytes, { contentType: imageFile.type, upsert: false }
      );
      if (uploadError) {
        console.error("Aahana video input upload failed:", uploadError.message);
        return NextResponse.json({ error: "Could not securely prepare the reference image." }, { status: 400 });
      }
      const { data: signed, error: signedError } = await supabase.storage
        .from("aahana-private").createSignedUrl(temporaryObjectPath, 300);
      if (signedError || !signed?.signedUrl) {
        return NextResponse.json({ error: "Could not securely access the reference image." }, { status: 500 });
      }
      providerInput.image = { url: signed.signedUrl };
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: VIDEO_MODEL, input: providerInput }),
        cache: "no-store",
        signal: AbortSignal.timeout(160000),
      }
    );

    const result = await response.json().catch(() => null);
    const videoUrl = result?.result?.video;
    if (!response.ok || result?.state === "Failed" || typeof videoUrl !== "string") {
      const providerStatus = response.status;
      const status = providerStatus === 429 ? 429 : providerStatus >= 500 ? 503 : 502;
      console.error("Aahana video provider request failed:", {
        status: providerStatus,
        providerState: result?.state || "unknown",
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
      mode: imageFile ? "image-to-video" : "text-to-video",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Aahana video generation request failed:", error?.name || "unknown error");
    return NextResponse.json({ error: "Video generation timed out or the provider is unavailable. Please try again." }, { status: 503 });
  } finally {
    if (temporaryObjectPath) {
      const { error } = await supabase.storage.from("aahana-private").remove([temporaryObjectPath]);
      if (error) console.error("Aahana temporary video image cleanup failed:", error.message);
    }
  }
}
