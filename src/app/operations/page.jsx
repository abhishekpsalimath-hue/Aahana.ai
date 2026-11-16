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
  const [briefObjective, setBriefObjective] = useState("");
  const [briefProject, setBriefProject] = useState("");
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [includeProjectContext, setIncludeProjectContext] = useState(false);
  const [briefContext, setBriefContext] = useState("");
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState("");
  const [briefHistory, setBriefHistory] = useState([]);
  const [selectedBriefId, setSelectedBriefId] = useState("");
  const [briefTaskBusy, setBriefTaskBusy] = useState(false);

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
    const [response, briefResponse, projectResponse] = await Promise.all([
      fetch("/api/operations", { cache: "no-store" }),
      fetch("/api/executives/brief", { cache: "no-store" }),
      fetch("/api/projects", { cache: "no-store" }),
    ]);
    const payload = await response.json().catch(() => ({}));
    const briefPayload = await briefResponse.json().catch(() => ({}));
    const projectPayload = await projectResponse.json().catch(() => ({}));
    if (projectResponse.ok) setProjects(projectPayload.projects || []);
    if (briefResponse.ok) {
      setBriefHistory(briefPayload.briefs || []);
      setSelectedBriefId((current) => current || briefPayload.briefs?.[0]?.id || "");
    }
    if (!response.ok) setError(payload.error || "Could not load operations.");
    else {
      setTasks(payload.tasks || []);
      setEvents(payload.events || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedBrief = useMemo(() => briefHistory.find((item) => item.id === selectedBriefId) || briefHistory[0] || null, [briefHistory, selectedBriefId]);

  async function runExecutiveBrief(event) {
    event.preventDefault();
    if (!briefObjective.trim()) return;
    setBriefLoading(true); setBriefError("");
    try {
      const response = await fetch("/api/executives/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective: briefObjective.trim(), projectLabel: briefProject.trim(), context: briefContext.trim(), includeProjectContext, projectId: includeProjectContext ? selectedProjectId : "" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) setBriefError(payload.error || "The executive team could not complete this brief.");
      else {
        setBriefHistory((current) => [payload.brief, ...current.filter((item) => item.id !== payload.brief.id)].slice(0, 10));
        setSelectedBriefId(payload.brief.id);
        setBriefObjective(""); setBriefContext("");
      }
    } catch {
      setBriefError("Could not connect to the executive workspace. Please retry.");
    } finally { setBriefLoading(false); }
  }

  async function addBriefToQueue() {
    if (!selectedBrief) return;
    setBriefTaskBusy(true); setError("");
    try {
      const response = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Executive follow-up: ${selectedBrief.objective}`.slice(0, 180),
          description: `CEO decision brief (draft; review before action):\n\n${selectedBrief.ceo_decision_brief}`.slice(0, 8000),
          assignedRole: "ceo", priority: "normal", source: "executive",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) setError(payload.error || "Could not add the decision brief to the task queue.");
      else setTasks((current) => [payload.task, ...current]);
    } catch { setError("Could not connect to the task queue. Please retry."); }
    finally { setBriefTaskBusy(false); }
  }

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


        <section className="ops-section ops-executive-brief">
          <div className="ops-section-heading"><div><div className="ops-eyebrow">MULTI-AGENT ORCHESTRATION / V1</div><h2>Ask the executive team</h2></div><span className="ops-muted">CTO + COO + CMO → CEO</span></div>
          <div className="ops-grid">
            <div className="ops-panel">
              <h2>What should the team analyse?</h2>
              <p className="ops-muted">Three specialist reports are generated in parallel. The CEO reconciles them into one decision brief. Only the information you enter here is shared with the roles.</p>
              <form className="ops-form" onSubmit={runExecutiveBrief}>
                <label>Objective<textarea rows={3} maxLength={4000} value={briefObjective} onChange={(e) => setBriefObjective(e.target.value)} placeholder="Example: Prepare a go-to-market strategy for Aahana's first 100 beta users." required /></label>
                <label>Project label (optional)<input maxLength={120} value={briefProject} onChange={(e) => setBriefProject(e.target.value)} placeholder="Aahana AI" /></label>
                <label>Context to share (optional)<textarea rows={4} maxLength={8000} value={briefContext} onChange={(e) => setBriefContext(e.target.value)} placeholder="Add facts, constraints, target dates or decisions already made." /></label>
                <label>Saved project (optional)<select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}><option value="">Choose a project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
                <label className="ops-context-consent"><input type="checkbox" checked={includeProjectContext} onChange={(e) => setIncludeProjectContext(e.target.checked)} disabled={!selectedProjectId} /> Include this selected project overview, recent conversations and file index.</label>
                <small className="ops-muted">Only the selected project is read after you enable this. The briefing receives its project details, up to five recent project conversations and file metadata—not document contents or other projects.</small>
                {briefError && <div className="ops-error" role="alert">{briefError}</div>}
                <button className="ops-primary" disabled={briefLoading || !briefObjective.trim()}>{briefLoading ? "Executive team is analysing…" : "Run executive briefing"}</button>
                <small className="ops-muted">Four AI calls per briefing. Results are saved privately to your account. No external action is executed.</small>
              </form>
            </div>
            <div className="ops-panel">
              <div className="ops-eyebrow">DECISION BRIEF ARCHIVE</div><h2>Recent briefings</h2>
              {briefHistory.length === 0 ? <div className="ops-empty">Your executive decision briefs will appear here.</div> : <div className="ops-brief-history">{briefHistory.map((item) => <button key={item.id} className={"ops-brief-history-item " + (selectedBrief?.id === item.id ? "selected" : "")} onClick={() => setSelectedBriefId(item.id)}><strong>{item.objective}</strong><span>{new Date(item.created_at).toLocaleString()} · {label(item.status)}</span></button>)}</div>}
            </div>
          </div>
          {selectedBrief && <div className="ops-brief-result">
            <div className="ops-section-heading"><div><div className="ops-eyebrow">CEO DECISION BRIEF</div><h2>{selectedBrief.project_label || "Executive review"}</h2></div><span className="ops-muted">{new Date(selectedBrief.created_at).toLocaleString()}</span></div>
            <article className="ops-panel ops-brief-ceo"><h3>CEO synthesis</h3><div className="ops-pre">{selectedBrief.ceo_decision_brief}</div><div className="ops-brief-actions"><button className="ops-primary" type="button" onClick={addBriefToQueue} disabled={briefTaskBusy}>{briefTaskBusy ? "Adding to queue…" : "Add draft follow-up to task queue"}</button><span className="ops-muted">Creates a proposed task only. You must approve it separately.</span></div></article>
            <div className="ops-role-grid ops-report-grid">{ROLES.filter((item) => item.id !== "ceo").map((item) => <article className="ops-panel ops-report" key={item.id}><div className="ops-eyebrow">{item.name} REPORT</div><div className="ops-pre">{selectedBrief.specialist_reports?.[item.id] || "No report saved."}</div></article>)}</div>
          </div>}
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
