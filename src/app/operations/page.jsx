"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const ROLES = [
  { id: "ceo", name: "CEO", scope: "Strategy, priorities and coordination" },
  { id: "cto", name: "CTO", scope: "Engineering, architecture and reliability" },
  { id: "coo", name: "COO", scope: "Operations, process and performance" },
  { id: "cmo", name: "CMO", scope: "Positioning, GTM and growth" },
];

const label = (value = "") => value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function OperationsPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [role, setRole] = useState("ceo");
  const [priority, setPriority] = useState("normal");

  const load = useCallback(async () => {
    setError("");
    const supabase = createClient();
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !currentUser) {
      setUser(null);
      setLoading(false);
      return;
    }
    setUser(currentUser);
    const response = await fetch("/api/operations", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setError(payload.error || "Could not load operations.");
    else {
      setTasks(payload.tasks || []);
      setEvents(payload.events || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    proposed: tasks.filter((task) => task.status === "proposed").length,
    approved: tasks.filter((task) => task.status === "approved").length,
    active: tasks.filter((task) => ["in_progress", "blocked"].includes(task.status)).length,
    completed: tasks.filter((task) => task.status === "completed").length,
  }), [tasks]);

  async function createTask(event) {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true); setError("");
    const response = await fetch("/api/operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), description: description.trim(), assignedRole: role, priority, source: "manual" }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setError(payload.error || "Could not create task.");
    else {
      setTasks((current) => [payload.task, ...current]);
      setTitle(""); setDescription(""); setRole("ceo"); setPriority("normal");
    }
    setBusy(false);
  }

  async function taskAction(id, action) {
    setBusy(true); setError("");
    const response = await fetch("/api/operations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setError(payload.error || "Could not update task.");
    else setTasks((current) => current.map((task) => task.id === id ? payload.task : task));
    setBusy(false);
  }

  if (loading) return <main className="ops-page"><div className="ops-loading">Loading Aahana Operations…</div></main>;
  if (!user) return <main className="ops-page"><section className="ops-auth"><div className="ops-eyebrow">AAHANA / OPERATIONS</div><h1>Your executive workspace</h1><p>Sign in to view your private operations workspace.</p><Link href="/login" className="ops-primary">Sign in</Link></section></main>;

  return (
    <main className="ops-page">
      <header className="ops-header">
        <Link href="/" className="ops-brand">Aahana<span> / Operations</span></Link>
        <div className="ops-header-right"><span>{user.email}</span><Link href="/">Back to assistant</Link></div>
      </header>
      <div className="ops-container">
        <section className="ops-hero">
          <div><div className="ops-eyebrow">SELF-OPERATIONS / V1</div><h1>Command Centre</h1><p>A private control room for reliability, executive tasks and decisions. Nothing executes without your approval.</p></div>
          <div className="ops-live"><i /> Approval-gated mode</div>
        </section>

        <section className="ops-metrics">
          {[["Needs review", counts.proposed],["Approved", counts.approved],["In progress / blocked", counts.active],["Completed", counts.completed]].map(([name, value]) => <article className="ops-metric" key={name}><span>{name}</span><strong>{value}</strong></article>)}
        </section>

        <section className="ops-section">
          <div className="ops-section-heading"><div><div className="ops-eyebrow">EXECUTIVE TEAM</div><h2>Four specialised roles</h2></div><span className="ops-muted">Draft and recommend only</span></div>
          <div className="ops-role-grid">{ROLES.map((item) => <article className="ops-role" key={item.id}><div className="ops-role-mark">{item.id.toUpperCase()}</div><h3>{item.name} AI</h3><p>{item.scope}</p><span>Read · Draft · Recommend</span></article>)}</div>
        </section>

        <section className="ops-grid">
          <div className="ops-panel">
            <div className="ops-eyebrow">TASK INTAKE</div><h2>Create an executive task</h2>
            <p className="ops-muted">Tasks start as proposals. Approval records your decision; it does not run an external action.</p>
            <form onSubmit={createTask} className="ops-form">
              <label>Task title<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={180} placeholder="e.g. Review research answer quality" required /></label>
              <label>Context<textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={8000} rows={4} placeholder="What should be investigated or improved?" /></label>
              <div className="ops-form-row">
                <label>Assign to<select value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map((item) => <option key={item.id} value={item.id}>{item.name} AI</option>)}</select></label>
                <label>Priority<select value={priority} onChange={(e) => setPriority(e.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
              </div>
              <button className="ops-primary" disabled={busy || !title.trim()}>{busy ? "Saving…" : "Add proposed task"}</button>
            </form>
          </div>
          <div className="ops-panel ops-safety">
            <div className="ops-eyebrow">SAFETY BOUNDARIES</div><h2>Human control stays on</h2>
            <ul><li>Tasks are private to your signed-in account.</li><li>Executive roles cannot deploy code or change billing.</li><li>Approval records intent; no worker executes the task yet.</li><li>System telemetry is kept separate from personal workspace events.</li><li>Prompts, chat messages and credentials are not written to the event feed.</li></ul>
          </div>
        </section>

        <section className="ops-section">
          <div className="ops-section-heading"><div><div className="ops-eyebrow">WORK QUEUE</div><h2>Executive tasks</h2></div><button className="ops-quiet" onClick={load}>Refresh</button></div>
          {error && <div className="ops-error" role="alert">{error}</div>}
          {tasks.length === 0 ? <div className="ops-empty">No tasks yet. Add the first item for the executive team.</div> : <div className="ops-task-list">{tasks.map((task) => <article className="ops-task" key={task.id}><div className="ops-task-main"><div className="ops-task-top"><span className={"ops-status status-" + task.status}>{label(task.status)}</span><span className="ops-muted">{label(task.priority)} priority · {label(task.assigned_role)} AI</span></div><h3>{task.title}</h3>{task.description && <p>{task.description}</p>}<small>{new Date(task.created_at).toLocaleString()}</small></div><div className="ops-task-actions">{task.status === "proposed" && <button disabled={busy} onClick={() => taskAction(task.id, "approve")}>Approve</button>}{["proposed","approved","blocked"].includes(task.status) && <button className="ops-danger" disabled={busy} onClick={() => taskAction(task.id, "cancel")}>Cancel</button>}{["cancelled","blocked"].includes(task.status) && <button disabled={busy} onClick={() => taskAction(task.id, "reopen")}>Reopen</button>}</div></article>)}</div>}
        </section>

        <section className="ops-section">
          <div className="ops-section-heading"><div><div className="ops-eyebrow">RELIABILITY / AUDIT TRAIL</div><h2>Recent events</h2></div><span className="ops-muted">{events.length} events</span></div>
          {events.length === 0 ? <div className="ops-empty">No reliability events recorded for this account yet.</div> : <div className="ops-events">{events.map((event) => <article className="ops-event" key={event.id}><span className={"ops-event-dot severity-" + event.severity} /><div><div className="ops-event-title">{event.summary}</div><p>{label(event.event_type)} · {label(event.severity)} · {label(event.source)}</p><small>{new Date(event.created_at).toLocaleString()}</small></div></article>)}</div>}
        </section>
        <footer className="ops-footer">Aahana Self-Operations v1 · Private workspace · Human approval required</footer>
      </div>
    </main>
  );
}
