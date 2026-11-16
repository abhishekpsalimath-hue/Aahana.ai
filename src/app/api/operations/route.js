import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ROLES = new Set(["ceo", "cto", "coo", "cmo"]);
const PRIORITIES = new Set(["low", "normal", "high", "urgent"]);

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const [tasksResult, eventsResult] = await Promise.all([
    supabase.from("aahana_ops_tasks")
      .select("id,title,description,assigned_role,priority,status,source,approval_required,approved_at,completed_at,created_at,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase.from("aahana_ops_events")
      .select("id,event_type,severity,source,summary,details,status,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (tasksResult.error || eventsResult.error) {
    console.error("Aahana operations workspace read failed:", {
      tasks: tasksResult.error?.message,
      events: eventsResult.error?.message,
    });
    return NextResponse.json({ error: "Could not load the operations workspace." }, { status: 500 });
  }

  return NextResponse.json({
    tasks: tasksResult.data || [],
    events: eventsResult.data || [],
  });
}

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const assignedRole = typeof body?.assignedRole === "string" ? body.assignedRole.toLowerCase() : "ceo";
  const priority = typeof body?.priority === "string" ? body.priority.toLowerCase() : "normal";
  const source = ["manual", "executive", "self_ops"].includes(body?.source) ? body.source : "manual";

  if (!title || title.length > 180 || description.length > 8000 ||
      !ROLES.has(assignedRole) || !PRIORITIES.has(priority)) {
    return NextResponse.json({ error: "Please provide a valid task title, description, role and priority." }, { status: 400 });
  }

  const { data, error } = await supabase.from("aahana_ops_tasks").insert({
    user_id: user.id,
    title,
    description,
    assigned_role: assignedRole,
    priority,
    source,
    status: "proposed",
    approval_required: true,
  }).select("id,title,description,assigned_role,priority,status,source,approval_required,created_at").single();

  if (error || !data) {
    console.error("Aahana operations task creation failed:", error?.message);
    return NextResponse.json({ error: "Could not create the task." }, { status: 500 });
  }

  return NextResponse.json({ task: data }, { status: 201 });
}
