import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSelfBuildConfig, isSelfBuildOwner } from "@/lib/build/self-build-policy.mjs";
import { getSelfBuildFile } from "@/lib/build/github-app.mjs";

export const runtime = "nodejs";

export async function GET(request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Please sign in to read Aahana's source." }, { status: 401 });

  const config = getSelfBuildConfig();
  if (!isSelfBuildOwner(user.email, config)) {
    return NextResponse.json({ error: "Aahana Self-Build is available only to its authorized owner." }, { status: 403 });
  }
  const params = new URL(request.url).searchParams;
  const path = params.get("path");
  const ref = params.get("ref");
  if (typeof ref !== "string" || !/^[a-f0-9]{40}$/i.test(ref)) {
    return NextResponse.json({ error: "Refresh the repository before reading a source file." }, { status: 400 });
  }
  try {
    const file = await getSelfBuildFile({ path, ref });
    return NextResponse.json(file, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Aahana self-build source read failed:", error?.message || "unknown error");
    return NextResponse.json({ error: "Aahana could not read this approved source file." }, { status: 400 });
  }
}
