import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getServiceClient } from "@/lib/operations/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const DAILY_DUTIES = [
  {
    role: "ceo",
    task_type: "daily_review",
    title: "CEO: daily company operating review",
    priority: 90,
    instructions: "Review only authorised, system-level company operating records and prior executive task outcomes. Identify the three highest-value priorities, cross-role dependencies, material risks and any genuine founder-level decisions. Create no claims unsupported by records. Do not inspect user conversations, private files, user memories or user-scoped workspace data. Return a concise evidence-linked executive brief.",
  },
  {
    role: "cto",
    task_type: "brain_quality_review",
    title: "CTO: platform health and brain-quality review",
    priority: 95,
    instructions: "Review only explicitly authorised platform health metrics, error summaries, evaluation results and engineering task outcomes. Identify regressions and propose measurable improvements to reasoning, factuality, citations, coding, multilingual behaviour, privacy and tool reliability. Do not access user content or secrets. Do not change code, models, prompts or production systems. Propose isolated experiments with baseline, success metric, safety guardrails and rollback criteria.",
  },
  {
    role: "coo",
    task_type: "health_review",
    title: "COO: execution and reliability review",
    priority: 80,
    instructions: "Review only system-owned task queues, run history, deadlines, retry counts and approved operational metrics. Identify stale work, repeated failures, bottlenecks and process improvements. Assign no external commitments and do not access user-scoped workspaces or private content. Report evidence, owner, urgency and measurable closure criteria.",
  },
  {
    role: "cmo",
    task_type: "growth_review",
    title: "CMO: product, market and growth review",
    priority: 60,
    instructions: "Review only approved public product/market evidence and authorised company-level growth metrics if available. If evidence is absent, state that clearly and propose a research plan rather than inventing market facts, customers, testimonials, traction or campaign results. Draft positioning and measurable acquisition, activation or retention experiments only; do not publish or contact anyone.",
  },
];

function istCycleKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `daily:${values.year}-${values.month}-${values.day}`;
}

function isAuthorised(request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization") || "";
  if (!secret || !supplied.startsWith("Bearer ")) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function GET(request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "System database is not configured." }, { status: 503 });
  }

  const cycleKey = istCycleKey();
  const { data: insertedRun, error: runInsertError } = await supabase
    .from("aahana_agent_runs")
    .upsert({
      cycle_key: cycleKey,
      trigger_source: "vercel_cron",
      status: "running",
      started_at: new Date().toISOString(),
      finished_at: null,
      summary: null,
      error_code: null,
    }, { onConflict: "cycle_key", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();

  if (runInsertError) {
    console.error("Aahana autonomous cycle could not create run:", runInsertError.message);
    return NextResponse.json({ error: "Could not start the executive cycle." }, { status: 500 });
  }

  let runId = insertedRun?.id;
  if (!runId) {
    const { data: existingRun, error: lookupError } = await supabase
      .from("aahana_agent_runs").select("id,status,summary").eq("cycle_key", cycleKey).maybeSingle();
    if (lookupError || !existingRun) {
      return NextResponse.json({ error: "Could not recover the existing executive cycle." }, { status: 500 });
    }
    if (existingRun.status === "completed") {
      return NextResponse.json({ ok: true, duplicate: true, cycle: cycleKey, summary: existingRun.summary });
    }
    runId = existingRun.id;
  }

  const tasks = DAILY_DUTIES.map((duty) => ({
    run_id: runId,
    dedupe_key: `${cycleKey}:${duty.role}`,
    role: duty.role,
    task_type: duty.task_type,
    title: duty.title,
    instructions: duty.instructions,
    priority: duty.priority,
    status: "queued",
  }));

  const { error: taskError } = await supabase
    .from("aahana_agent_tasks")
    .upsert(tasks, { onConflict: "dedupe_key", ignoreDuplicates: true });

  if (taskError) {
    await supabase.from("aahana_agent_runs").update({
      status: "failed", finished_at: new Date().toISOString(), error_code: "queue_write_failed",
    }).eq("id", runId);
    console.error("Aahana autonomous cycle queue write failed:", taskError.message);
    return NextResponse.json({ error: "Could not queue executive duties." }, { status: 500 });
  }

  const summary = "Daily CEO, CTO, COO and CMO duties were placed in the system-owned queue. No user workspace data was accessed and no external actions were performed.";
  const { error: finishError } = await supabase.from("aahana_agent_runs").update({
    status: "completed",
    finished_at: new Date().toISOString(),
    summary,
    error_code: null,
  }).eq("id", runId);

  if (finishError) {
    console.error("Aahana autonomous cycle finalisation failed:", finishError.message);
    return NextResponse.json({ error: "Executive duties were queued but the run could not be finalised." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, duplicate: false, cycle: cycleKey, queued: DAILY_DUTIES.length, roles: DAILY_DUTIES.map((duty) => duty.role) });
}
