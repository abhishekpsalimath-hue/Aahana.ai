import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSelfBuildConfig, isSelfBuildOwner } from "@/lib/build/self-build-policy.mjs";
import { getSelfBuildRepository } from "@/lib/build/github-app.mjs";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Please sign in to inspect Aahana's repository." }, { status: 401 });

  const config = getSelfBuildConfig();
  if (!isSelfBuildOwner(user.email, config)) {
    return NextResponse.json({ error: "Aahana Self-Build is available only to its authorized owner." }, { status: 403 });
  }
  try {
    const repository = await getSelfBuildRepository();
    return NextResponse.json(repository, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Aahana self-build repository inspection failed:", error?.message || "unknown error");
    return NextResponse.json({ error: "Aahana could not inspect its repository. Check the GitHub App connection." }, { status: 503 });
  }
}
