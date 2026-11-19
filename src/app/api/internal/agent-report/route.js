import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getServiceClient } from "@/lib/operations/server";
import { buildAgentReport } from "@/lib/operations/agent-worker.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorised(request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization") || "";
  if (!secret || !supplied.startsWith("Bearer ")) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function GET(request) {
  if (!isAuthorised(request)) return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "System database is not configured." }, { status: 503 });

  const url = new URL(request.url);
  const requestedSince = url.searchParams.get("since");
  const parsedSince = requestedSince ? new Date(requestedSince) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (Number.isNaN(parsedSince.getTime())) return NextResponse.json({ error: "Invalid since timestamp." }, { status: 400 });
  const minimum = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const since = new Date(Math.max(parsedSince.getTime(), minimum)).toISOString();

  const [runsResult, tasksResult, eventsResult] = await Promise.all([
    supabase.from("aahana_agent_runs")
      .select("id,cycle_key,status,started_at,finished_at,summary,error_code")
      .gte("started_at", since).order("started_at", { ascending: false }).limit(10),
    supabase.from("aahana_agent_tasks")
      .select("id,run_id,role,title,status,attempts,error_code,created_at,updated_at,finished_at,result")
      .gte("created_at", since).order("created_at", { ascending: false }).limit(100),
    supabase.from("aahana_agent_task_events")
      .select("id,task_id,run_id,event_type,attempt,summary,created_at")
      .gte("created_at", since).order("created_at", { ascending: false }).limit(50),
  ]);

  if (runsResult.error || tasksResult.error || eventsResult.error) {
    console.error("Aahana worker report read failed:", {
      runs: runsResult.error?.message,
      tasks: tasksResult.error?.message,
      events: eventsResult.error?.message,
    });
    return NextResponse.json({ error: "Could not assemble the worker activity report." }, { status: 500 });
  }

  const report = buildAgentReport({
    runs: runsResult.data || [],
    tasks: tasksResult.data || [],
    events: eventsResult.data || [],
    generatedAt: new Date().toISOString(),
    windowStart: since,
  });
  return NextResponse.json({ ok: true, report });
}
