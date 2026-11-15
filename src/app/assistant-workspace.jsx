"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const modes = [
  { id: "solve", label: "Solve", hint: "Work through a problem" },
  { id: "create", label: "Create", hint: "Make something new" },
  { id: "write", label: "Write", hint: "Shape your thoughts" },
  { id: "build", label: "Build", hint: "Turn ideas into products" },
  { id: "improve", label: "Improve", hint: "Make it better" },
];

const starters = [
  "Help me think through a difficult decision",
  "Turn this idea into a clear action plan",
  "Write something thoughtful and concise",
  "Help me design an app or website",
];

export default function Home({ userEmail = "", aiEnabled = false }) {
  const router = useRouter();
  const [mode, setMode] = useState("solve");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [projects, setProjects] = useState([]);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projectBusy, setProjectBusy] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [filesError, setFilesError] = useState("");

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  function newConversation() {
    setPrompt("");
    setMessages([]);
    setConversationId(null);
    setError("");
    setUsage(null);
    setMode("solve");
  }

  async function toggleHistory() {
    const nextOpen = !historyOpen;
    setHistoryOpen(nextOpen);
    if (!nextOpen || history.length) return;
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const historyUrl = selectedProjectId ? `/api/conversations?projectId=${encodeURIComponent(selectedProjectId)}` : "/api/conversations";
      const response = await fetch(historyUrl);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not load history.");
      setHistory(result.conversations || []);
    } catch (err) {
      setHistoryError(err.message || "Could not load history.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function openConversation(id) {
    if (busy) return;
    setHistoryError("");
    try {
      const response = await fetch(`/api/conversations/${encodeURIComponent(id)}`);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not open conversation.");
      setConversationId(result.conversation.id);
      setSelectedProjectId(result.conversation.project_id || null);
      setHistory([]);
      setMode(result.conversation.mode || "solve");
      setMessages((result.messages || []).map(({ role, content }) => ({ role, content })));
      setPrompt("");
      setError("");
      setUsage(null);
      setHistoryOpen(false);
    } catch (err) {
      setHistoryError(err.message || "Could not open conversation.");
    }
  }

  async function toggleProjects() {
    const nextOpen = !projectsOpen;
    setProjectsOpen(nextOpen);
    if (!nextOpen || projects.length) return;
    setProjectsLoading(true);
    setProjectsError("");
    try {
      const response = await fetch("/api/projects");
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not load projects.");
      setProjects(result.projects || []);
    } catch (err) {
      setProjectsError(err.message || "Could not load projects.");
    } finally {
      setProjectsLoading(false);
    }
  }

  async function toggleFiles() {
    const nextOpen = !filesOpen;
    setFilesOpen(nextOpen);
    if (!nextOpen) return;
    setFilesLoading(true);
    setFilesError("");
    try {
      const query = selectedProjectId ? `?projectId=${encodeURIComponent(selectedProjectId)}` : "";
      const response = await fetch(`/api/files${query}`);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not load files.");
      setFiles(result.files || []);
    } catch (err) {
      setFilesError(err.message || "Could not load files.");
    } finally {
      setFilesLoading(false);
    }
  }

  async function uploadFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || fileBusy) return;
    setFileBusy(true);
    setFilesError("");
    try {
      const allowed = ["application/pdf", "text/plain", "text/markdown", "text/csv", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "image/png", "image/jpeg", "image/webp"];
      if (!allowed.includes(file.type)) throw new Error("This file type is not supported.");
      if (file.size < 1 || file.size > 10 * 1024 * 1024) throw new Error("Files must be between 1 byte and 10 MB.");
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Please sign in again.");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "upload";
      const folder = selectedProjectId || "personal";
      const objectPath = `${user.id}/${folder}/${crypto.randomUUID()}-${safeName}`;
      const { error: storageError } = await supabase.storage.from("aahana-private").upload(objectPath, file, { contentType: file.type, upsert: false });
      if (storageError) throw new Error("Upload failed. Please try again.");
      const response = await fetch("/api/files", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectPath, originalFilename: file.name, mimeType: file.type, sizeBytes: file.size, projectId: selectedProjectId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        await supabase.storage.from("aahana-private").remove([objectPath]);
        throw new Error(result.error || "Could not save file details.");
      }
      setFiles((items) => [result.file, ...items]);
    } catch (err) {
      setFilesError(err.message || "Upload failed.");
    } finally {
      setFileBusy(false);
    }
  }

  async function openFile(id) {
    try {
      const response = await fetch(`/api/files/${encodeURIComponent(id)}`);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not open file.");
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setFilesError(err.message || "Could not open file.");
    }
  }

  async function deleteFile(id) {
    const response = await fetch(`/api/files/${encodeURIComponent(id)}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setFilesError(result.error || "Could not delete file."); return; }
    setFiles((items) => items.filter((item) => item.id !== id));
  }

  async function createProject(event) {
    event.preventDefault();
    if (!projectName.trim() || projectBusy) return;
    setProjectBusy(true);
    setProjectsError("");
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectName.trim(), description: projectDescription.trim(), project_type: "other" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not create project.");
      setProjects((items) => [result.project, ...items]);
      setSelectedProjectId(result.project.id);
      setProjectName("");
      setProjectDescription("");
      setShowProjectForm(false);
      setMessages([]);
      setConversationId(null);
      setHistory([]);
      setHistoryOpen(false);
    } catch (err) {
      setProjectsError(err.message || "Could not create project.");
    } finally {
      setProjectBusy(false);
    }
  }

  function selectProject(id) {
    setSelectedProjectId(id);
    setConversationId(null);
    setMessages([]);
    setPrompt("");
    setHistory([]);
    setHistoryOpen(false);
    setError("");
    setUsage(null);
  }

  async function archiveProject(id) {
    const response = await fetch(`/api/projects/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "archived" }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setProjectsError(result.error || "Could not archive project."); return; }
    setProjects((items) => items.filter((item) => item.id !== id));
    if (selectedProjectId === id) selectProject(null);
  }

  async function submitPrompt(event) {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || busy || !aiEnabled) return;

    setPrompt("");
    setError("");
    setBusy(true);
    const userMessage = { role: "user", content: text };
    const assistantMessage = { role: "assistant", content: "" };
    setMessages((current) => [...current, userMessage, assistantMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, mode, conversationId, projectId: selectedProjectId }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Aahana couldn't process that request.");
      }

      const nextConversationId = response.headers.get("X-Conversation-Id");
      if (nextConversationId) setConversationId(nextConversationId);
      const used = response.headers.get("X-Requests-Used");
      const limit = response.headers.get("X-Requests-Limit");
      if (used && limit) setUsage({ used: Number(used), limit: Number(limit) });

      if (!response.body) throw new Error("The response stream was unavailable.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages((current) => current.map((item, index) =>
          index === current.length - 1 ? { ...item, content: answer } : item
        ));
      }
      answer += decoder.decode();
      setMessages((current) => current.map((item, index) =>
        index === current.length - 1 ? { ...item, content: answer || "I couldn't generate a response. Please try again." } : item
      ));
      setHistory([]);
    } catch (err) {
      setMessages((current) => current.filter((item, index) => !(index === current.length - 1 && item.role === "assistant" && !item.content)));
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Aahana home">
          <span className="brand-mark">a</span>
          <span> aahana</span>
        </a>
        <button className="new-chat" type="button" onClick={newConversation}>
          <span aria-hidden="true">＋</span> New conversation
        </button>
        <div className="side-label">WORKSPACE</div>
        <button className={selectedProjectId ? "side-item assistant-nav" : "side-item active assistant-nav"} type="button" onClick={() => selectProject(null)}>✳ <span>Assistant</span></button>
        <button className={historyOpen ? "side-item active history-toggle" : "side-item muted history-toggle"} type="button" onClick={toggleHistory}>◷ <span>History</span></button>
        {historyOpen && (
          <div className="history-list">
            {historyLoading && <div className="history-empty">Loading conversations…</div>}
            {historyError && <div className="history-empty history-error">{historyError}</div>}
            {!historyLoading && !historyError && history.length === 0 && <div className="history-empty">No saved conversations yet.</div>}
            {history.map((item) => (
              <button className={conversationId === item.id ? "history-entry selected" : "history-entry"} type="button" key={item.id} onClick={() => openConversation(item.id)}>
                <span>{item.title || "New conversation"}</span>
                <small>{item.mode}</small>
              </button>
            ))}
          </div>
        )}
        <button className={projectsOpen ? "side-item active project-toggle" : "side-item muted project-toggle"} type="button" onClick={toggleProjects}>▧ <span>Projects</span></button>
        <button className={filesOpen ? "side-item active project-toggle" : "side-item muted project-toggle"} type="button" onClick={toggleFiles}>⌁ <span>Files</span></button>
        {projectsOpen && (
          <div className="project-list">
            {projectsLoading && <div className="history-empty">Loading projects…</div>}
            {projectsError && <div className="history-empty history-error">{projectsError}</div>}
            {!projectsLoading && !projectsError && projects.length === 0 && <div className="history-empty">No projects yet.</div>}
            {projects.map((project) => (
              <div className="project-row" key={project.id}>
                <button className={selectedProjectId === project.id ? "project-entry selected" : "project-entry"} type="button" onClick={() => selectProject(project.id)}>
                  <span>{project.name}</span><small>{project.status}</small>
                </button>
                <button className="project-archive" type="button" aria-label={`Archive ${project.name}`} onClick={() => archiveProject(project.id)}>×</button>
              </div>
            ))}
            {showProjectForm ? (
              <form className="project-create-form" onSubmit={createProject}>
                <input value={projectName} onChange={(event) => setProjectName(event.target.value)} maxLength={80} placeholder="Project name" aria-label="Project name" required />
                <textarea value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} maxLength={500} placeholder="Short description (optional)" aria-label="Project description" rows={2} />
                <div><button type="button" onClick={() => setShowProjectForm(false)}>Cancel</button><button type="submit" disabled={!projectName.trim() || projectBusy}>{projectBusy ? "Saving…" : "Create"}</button></div>
              </form>
            ) : (
              <button className="project-add" type="button" onClick={() => setShowProjectForm(true)}>＋ New project</button>
            )}
          </div>
        )}
        <div className="sidebar-bottom">
          <div className="avatar">A</div>
          <div className="account-copy"><strong>Your workspace</strong><small>{userEmail || "Personal"}</small></div>
          <button className="sign-out" type="button" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> {selectedProjectId ? (projects.find((item) => item.id === selectedProjectId)?.name || "Project") : "Assistant"}</div>
          <div className="top-actions"><button className="mobile-history-toggle" type="button" onClick={toggleProjects}>Projects</button><button className="mobile-history-toggle" type="button" onClick={toggleHistory}>History</button><span>Private workspace</span></div>
        </header>
        {projectsOpen && (
          <div className="mobile-project-panel">
            {projectsLoading && <div className="history-empty">Loading projects…</div>}
            {projectsError && <div className="history-empty history-error">{projectsError}</div>}
            {projects.map((project) => <button className="project-entry" type="button" key={project.id} onClick={() => selectProject(project.id)}>{project.name}</button>)}
            <button className="project-add" type="button" onClick={() => setShowProjectForm((value) => !value)}>＋ New project</button>
            {showProjectForm && <form className="project-create-form" onSubmit={createProject}><input value={projectName} onChange={(event) => setProjectName(event.target.value)} maxLength={80} placeholder="Project name" aria-label="Project name" required /><button type="submit" disabled={!projectName.trim() || projectBusy}>{projectBusy ? "Saving…" : "Create project"}</button></form>}
          </div>
        )}
        {historyOpen && (
          <div className="mobile-history-panel">
            {historyLoading && <div className="history-empty">Loading conversations…</div>}
            {historyError && <div className="history-empty history-error">{historyError}</div>}
            {!historyLoading && !historyError && history.length === 0 && <div className="history-empty">No saved conversations yet.</div>}
            {history.map((item) => (
              <button className="history-entry" type="button" key={item.id} onClick={() => openConversation(item.id)}>
                <span>{item.title || "New conversation"}</span><small>{item.mode}</small>
              </button>
            ))}
          </div>
        )}

        <div className="welcome">
          <div className="eyebrow"><span /> YOUR THINKING SPACE</div>
          {!messages.length && <>
            <h1>Good ideas start<br /><em>somewhere.</em></h1>
            <p>Bring a question, a challenge, or an idea.<br className="desktop-break" /> We’ll shape the next step together.</p>
          </>}

          <div className="mode-row" role="tablist" aria-label="Choose a mode">
            {modes.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={mode === item.id}
                className={mode === item.id ? "mode active-mode" : "mode"}
                onClick={() => setMode(item.id)}>
                {item.label}
              </button>
            ))}
          </div>

          {messages.length > 0 && (
            <div className="conversation" aria-live="polite">
              {messages.map((item, index) => (
                <article className={item.role === "user" ? "chat-message user-message" : "chat-message assistant-message"} key={index}>
                  <div className="message-role">{item.role === "user" ? "YOU" : "AAHANA"}</div>
                  <p>{item.content || (busy ? "Thinking…" : "")}</p>
                </article>
              ))}
            </div>
          )}

          <form className="composer" onSubmit={submitPrompt}>
            <label className="sr-only" htmlFor="prompt">What would you like to work on?</label>
            <textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)}
              placeholder={aiEnabled ? "What would you like to work on today?" : "Aahana is preparing its AI connection…"} rows={3} disabled={busy || !aiEnabled} />
            <div className="composer-footer">
              <span className="composer-mode">{modes.find((item) => item.id === mode)?.hint}</span>
              <button className="send" type="submit" disabled={!prompt.trim() || busy || !aiEnabled} aria-label="Submit prompt">{busy ? "…" : "↑"}</button>
            </div>
          </form>
          {error && <div className="notice error-notice" role="alert">{error}</div>}
          {usage && <div className="notice">Today: {usage.used} of {usage.limit} AI requests used.</div>}
          {!messages.length && (
            <>
              <div className="notice">{aiEnabled ? "Your workspace is ready. Send a prompt to begin." : "Your workspace is ready. AI activation is pending billing and connection checks. Prompts are not sent yet."}</div>
              <div className="starter-grid">
                {starters.map((item, index) => (
                  <button className="starter" type="button" key={item} onClick={() => setPrompt(item)}>
                    <span className="starter-icon">{["◇", "↗", "✎", "⌘"][index]}</span>
                    <span>{item}</span>
                    <span className="starter-arrow">↗</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <footer className="footer"><span>AAHANA</span><span>Thoughtfully made for what’s next.</span></footer>
      </section>
    </main>
  );
}
