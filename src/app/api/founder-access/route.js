import { NextResponse } from "next/server";
import { getFounderSession } from "@/lib/auth/founder-session.js";

export const runtime = "nodejs";

export async function GET() {
  const { user, response } = await getFounderSession();
  if (response) return response;
  return NextResponse.json({ allowed: true, user: { id: user.id, email: user.email || null } }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
