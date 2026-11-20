import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSelfBuildConfig, isSelfBuildOwner } from "@/lib/build/self-build-policy.mjs";
import { createSelfBuildPullRequest } from "@/lib/build/github-app.mjs";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 3 * 1024 * 1024;

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Please sign in to propose a self-build change." }, { status: 401 });

  const config = getSelfBuildConfig();
  if (!isSelfBuildOwner(user.email, config)) {
    return NextResponse.json({ error: "Aahana Self-Build is available only to its authorized owner." }, { status: 403 });
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) return NextResponse.json({ error: "Self-build proposal is too large." }, { status: 413 });
  let body;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) return NextResponse.json({ error: "Self-build proposal is too large." }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid self-build proposal." }, { status: 400 });
  }

  try {
    const result = await createSelfBuildPullRequest({
      baseSha: body?.baseSha,
      files: body?.files,
      title: body?.title,
      summary: body?.summary,
    });
    return NextResponse.json({ pullRequest: result }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const conflict = /base branch changed/i.test(error?.message || "");
    console.error("Aahana self-build proposal failed:", error?.message || "unknown error");
    return NextResponse.json({
      error: conflict
        ? "Aahana's main branch changed while you were editing. Refresh the repository and review the latest source."
        : "Aahana could not create the review pull request. Check the repository connection and proposal.",
    }, { status: conflict ? 409 : 400 });
  }
}
