import { NextResponse } from "next/server";
import { getFounderSession } from "@/lib/auth/founder-session.js";
import { PRIVATE_AUTOMATION_TEMPLATES } from "@/lib/operations/automation-policy.mjs";
import { getNextAutomationRun } from "@/lib/operations/schedule-policy.mjs";

export const runtime = "nodejs";

export async function POST(request) {
  const { response } = await getFounderSession();
  if (response) return response;

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid schedule preview request." }, { status: 400 });
  }

  const template = PRIVATE_AUTOMATION_TEMPLATES.find((item) => item.id === body?.templateId);
  if (!template) return NextResponse.json({ error: "Unknown automation template." }, { status: 400 });
  if (!["daily", "weekly"].includes(template.cadence)) {
    return NextResponse.json({ error: "This automation is event-driven or manual and has no clock schedule." }, { status: 422 });
  }

  const time = typeof body?.time === "string" ? body.time : "09:00";
  const match = /^(?:([01]\d|2[0-3])):([0-5]\d)$/.exec(time);
  if (!match) return NextResponse.json({ error: "Choose a valid local time in HH:MM format." }, { status: 400 });

  try {
    const preview = getNextAutomationRun({
      cadence: template.cadence,
      timeZone: typeof body?.timeZone === "string" ? body.timeZone : "Asia/Kolkata",
      hour: Number(match[1]),
      minute: Number(match[2]),
      ...(template.cadence === "weekly" ? { weekday: Number(body?.weekday) } : {}),
    });
    return NextResponse.json({
      template: { id: template.id, name: template.name },
      ...preview,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not preview the schedule." }, { status: 400 });
  }
}
