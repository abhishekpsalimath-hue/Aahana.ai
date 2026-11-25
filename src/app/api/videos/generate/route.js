import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseVideoGenerationInput, validateVideoReferenceImage, VIDEO_MODEL } from "@/lib/creative/video-generation.mjs";
import { readBoundedRequestBody } from "@/lib/http/bounded-request-body.mjs";

export const runtime = "nodejs";
export const maxDuration = 180;

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_VIDEO_REQUEST_BYTES = MAX_IMAGE_BYTES + 128 * 1024;

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

  const contentType = request.headers.get("content-type") || "";
  if (!/^multipart\/form-data;\s*boundary=(?:"[^"]+"|[^;]+)$/i.test(contentType)) {
    return NextResponse.json({ error: "Invalid video request." }, { status: 400 });
  }
  const boundedBody = await readBoundedRequestBody(request, MAX_VIDEO_REQUEST_BYTES);
  if (!boundedBody.ok) {
    return NextResponse.json(
      { error: boundedBody.reason === "too-large" ? "The video request exceeds the 2 MB image-upload limit." : "Invalid video request." },
      { status: boundedBody.reason === "too-large" ? 413 : 400 }
    );
  }

  let input;
  let imageFile = null;
  try {
    const form = await new Response(boundedBody.bytes, { headers: { "content-type": contentType } }).formData();
    input = parseVideoGenerationInput({
      prompt: form.get("prompt"),
      duration: form.get("duration") === null ? undefined : Number(form.get("duration")),
      aspectRatio: form.get("aspectRatio") ?? undefined,
      resolution: form.get("resolution") ?? undefined,
      director: form.get("director") ?? undefined,
    });
    imageFile = form.get("image");
  } catch {
    return NextResponse.json({ error: "Invalid video request." }, { status: 400 });
  }
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

  if (imageFile && (typeof imageFile.arrayBuffer !== "function" ||
      !ALLOWED_IMAGE_TYPES.has(imageFile.type) || imageFile.size < 1 || imageFile.size > MAX_IMAGE_BYTES)) {
    return NextResponse.json({ error: "Choose a PNG, JPEG or WebP image up to 2 MB." }, { status: 400 });
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
      const bytes = new Uint8Array(await imageFile.arrayBuffer());
      const validation = validateVideoReferenceImage({ bytes, imageType: imageFile.type, imageSize: imageFile.size });
      if (!validation.ok) {
        temporaryObjectPath = null;
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      const { error: uploadError } = await supabase.storage.from("aahana-private").upload(
        temporaryObjectPath, bytes, { contentType: imageFile.type, upsert: false }
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
