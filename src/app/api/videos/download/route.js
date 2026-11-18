import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isTrustedGeneratedVideoUrl } from "@/lib/ai/video-generation-policy.mjs";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function GET(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in to download this video." }, { status: 401 });
  }

  const sourceUrl = new URL(request.url).searchParams.get("url");
  if (!isTrustedGeneratedVideoUrl(sourceUrl)) {
    return NextResponse.json({ error: "Invalid video download URL." }, { status: 400 });
  }

  try {
    const upstream = await fetch(sourceUrl, {
      method: "GET",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(150000),
    });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "The temporary video file is no longer available. Generate it again." }, { status: 502 });
    }

    const headers = new Headers({
      "Content-Type": "video/mp4",
      "Content-Disposition": 'attachment; filename="aahana-video.mp4"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    const length = upstream.headers.get("content-length");
    if (length && /^\d+$/.test(length)) headers.set("Content-Length", length);
    return new Response(upstream.body, { status: 200, headers });
  } catch (error) {
    console.error("Aahana video download failed:", error?.name || "unknown error");
    return NextResponse.json({ error: "Video download timed out or the provider is unavailable." }, { status: 502 });
  }
}
