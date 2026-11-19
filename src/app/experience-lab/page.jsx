"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSourceFileMimeType, isSupportedSourceFile } from "@/lib/build/source-file-policy.mjs";
import "./experience-lab.css";

const modes = [
  { id: "chat", label: "Ask", mark: "✳", hint: "Think out loud" },
  { id: "create", label: "Create", mark: "◈", hint: "Make something vivid" },
  { id: "build", label: "Build", mark: "⌘", hint: "Shape an idea into software" },
  { id: "research", label: "Explore", mark: "⌕", hint: "Go deeper, find signal" },
  { id: "learn", label: "Learn", mark: "⌁", hint: "Understand anything" },
];

const prompts = [
  { mark: "◌", title: "Think with me", detail: "Untangle a big idea", prompt: "Help me think through a bold idea and challenge my assumptions." },
  { mark: "✧", title: "Make a visual", detail: "Turn words into worlds", prompt: "Help me create a cinematic visual concept for a new product." },
  { mark: "⌘", title: "Build something", detail: "From blank page to product", prompt: "Help me plan and build a polished web app from this idea." },
  { mark: "⌕", title: "Find the signal", detail: "Research beyond the obvious", prompt: "Research this topic deeply and separate evidence from assumptions." },
];

const promptsByMode = {
  chat: [
    { mark: "◌", title: "Think with me", detail: "Untangle a big idea", prompt: "Help me think through a bold idea and challenge my assumptions." },
    { mark: "◇", title: "See another angle", detail: "Find the perspective I'm missing", prompt: "Show me three different perspectives on this problem." },
    { mark: "✧", title: "Make a decision", detail: "Compare paths clearly", prompt: "Help me compare my options and choose a practical next step." },
    { mark: "⌁", title: "Explain simply", detail: "Make a hard idea click", prompt: "Explain this clearly with an analogy and a practical example." },
  ],
  create: [
    { mark: "✧", title: "Set the art direction", detail: "Mood, palette and visual language", prompt: "Create a distinctive art direction with mood, palette, lighting and composition." },
    { mark: "◈", title: "Shape a character", detail: "Build a memorable visual identity", prompt: "Help me design an original character with a consistent visual identity." },
    { mark: "▧", title: "Storyboard a scene", detail: "Turn an idea into frames", prompt: "Build a cinematic storyboard with clear camera movement and shot descriptions." },
    { mark: "✳", title: "Explore styles", detail: "Compare creative directions", prompt: "Give me three visually distinct creative directions for this idea." },
  ],
  build: [
    { mark: "⌘", title: "Map the product", detail: "Users, journeys and core value", prompt: "Map the product requirements, user journeys and smallest useful release." },
    { mark: "⌁", title: "Design the system", detail: "Architecture before implementation", prompt: "Propose a secure, scalable architecture and explain the trade-offs." },
    { mark: "⚙", title: "Debug a problem", detail: "Trace causes, not symptoms", prompt: "Help me isolate the root cause, reproduce it and propose a tested fix." },
    { mark: "↗", title: "Review the code", detail: "Quality, security and performance", prompt: "Review this implementation for correctness, security, accessibility and performance." },
  ],
  research: [
    { mark: "⌕", title: "Find primary evidence", detail: "Start with reliable sources", prompt: "Research this topic using primary sources and cite the strongest evidence." },
    { mark: "◇", title: "Compare viewpoints", detail: "Separate facts from claims", prompt: "Compare the leading viewpoints and identify where evidence disagrees." },
    { mark: "✧", title: "Trace a trend", detail: "What changed and why", prompt: "Trace the history of this trend and explain the forces behind it." },
    { mark: "▤", title: "Build a briefing", detail: "Findings, gaps and implications", prompt: "Create a concise research briefing with findings, uncertainties and implications." },
  ],
  learn: [
    { mark: "⌁", title: "Teach me from zero", detail: "Build intuition first", prompt: "Teach me this from first principles with examples and a short recap." },
    { mark: "✳", title: "Test my understanding", detail: "Questions that reveal gaps", prompt: "Quiz me progressively and explain any mistakes without giving away answers too early." },
    { mark: "◈", title: "Use a real example", detail: "Connect theory to practice", prompt: "Explain this concept through a realistic step-by-step example." },
    { mark: "↗", title: "Go advanced", detail: "Push beyond the basics", prompt: "Take me to an advanced level and show the deeper connections." },
  ],
};

function requestsImage(value) {
  const text = String(value || "").trim();
  return /\b(?:generate|create|draw|render|make)\b[\s\S]{0,120}\b(?:image|picture|illustration|artwork|portrait|wallpaper|logo|poster|cover|banner|thumbnail|scene|landscape)\b/i.test(text)
    || /\b(?:image|picture|illustration|artwork)\b[\s\S]{0,80}\b(?:generate|create|draw|render)\b/i.test(text);
}

function OrbitMark() {
  return <div className="lab-orbit" aria-hidden="true">
    <span className="lab-orbit-ring ring-a" /><span className="lab-orbit-ring ring-b" />
    <span className="lab-orbit-core" /><span className="lab-orbit-moon" />
    <span className="lab-orbit-star star-a" /><span className="lab-orbit-star star-b" />
  </div>;
}

export default function ExperienceLab() {
  const [mode, setMode] = useState("chat");
  const [prompt, setPrompt] = useState("");
  const [thread, setThread] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [generatedImage, setGeneratedImage] = useState(null);
  const activeRequest = useRef(null);
  const [buildProjects, setBuildProjects] = useState([]);
  const [buildFiles, setBuildFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [editingFile, setEditingFile] = useState(null);
  const [sourceDraft, setSourceDraft] = useState("");
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const buildFileInput = useRef(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [buildStatus, setBuildStatus] = useState(null);
  const [buildBusy, setBuildBusy] = useState(false);
  const [buildResult, setBuildResult] = useState(null);
  const [buildError, setBuildError] = useState("");
  const [focus, setFocus] = useState(false);
  const [activePanel, setActivePanel] = useState("tools");
  const current = modes.find((item) => item.id === mode) || modes[0];
  const currentPrompts = promptsByMode[mode] || promptsByMode.chat;

  useEffect(() => {
    if (mode !== "build") return;
    let active = true;
    Promise.all([
      fetch("/api/projects", { cache: "no-store" }).then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load projects.");
        return data.projects || [];
      }),
      fetch("/api/build/status", { cache: "no-store" }).then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not inspect Build Engine status.");
        return data;
      }),
    ]).then(([projects, status]) => {
      if (!active) return;
      setBuildProjects(projects);
      setSelectedProjectId((current) => current || projects[0]?.id || "");
      setBuildStatus(status);
      setBuildError("");
    }).catch((error) => {
      if (active) setBuildError(error.message || "Build workspace could not be loaded.");
    });
    return () => { active = false; };
  }, [mode]);

  useEffect(() => {
    if (mode !== "build" || !selectedProjectId) {
      setBuildFiles([]);
      return;
    }
    let active = true;
    setFilesLoading(true);
    fetch(`/api/files?projectId=${encodeURIComponent(selectedProjectId)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load project files.");
        return data.files || [];
      })
      .then((files) => { if (active) setBuildFiles(files); })
      .catch((error) => { if (active) setBuildError(error.message || "Could not load project files."); })
      .finally(() => { if (active) setFilesLoading(false); });
    return () => { active = false; };
  }, [mode, selectedProjectId]);

  async function openSourceEditor(file) {
    if (!isSupportedSourceFile(file.original_filename, file.mime_type)) return;
    setEditorLoading(true);
    setBuildError("");
    try {
      const response = await fetch(`/api/files/${encodeURIComponent(file.id)}/content`, { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not open source file.");
      setEditingFile(file);
      setSourceDraft(result.file.content);
    } catch (error) {
      setBuildError(error.message || "Could not open source file.");
    } finally {
      setEditorLoading(false);
    }
  }

  async function saveSourceFile() {
    if (!editingFile || editorSaving) return;
    setEditorSaving(true);
    setBuildError("");
    try {
      const response = await fetch(`/api/files/${encodeURIComponent(editingFile.id)}/content`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: sourceDraft }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not save source file.");
      setBuildFiles((current) => current.map((file) => file.id === editingFile.id ? { ...file, size_bytes: result.sizeBytes } : file));
      setEditingFile(null);
      setSourceDraft("");
      setBuildResult(null);
    } catch (error) {
      setBuildError(error.message || "Could not save source file.");
    } finally {
      setEditorSaving(false);
    }
  }

  async function uploadBuildFiles(event) {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    if (!selected.length || fileBusy || !selectedProjectId) return;
    setFileBusy(true);
    setBuildError("");
    const supabase = createClient();
    let pendingPath = null;
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Please sign in again.");
      for (const file of selected) {
        const mimeType = getSourceFileMimeType(file.name, file.type);
        if (!isSupportedSourceFile(file.name, mimeType)) {
          throw new Error(`${file.name}: unsupported source-file type.`);
        }
        if (file.size < 1 || file.size > 1024 * 1024) {
          throw new Error(`${file.name}: source files must be 1 MB or smaller.`);
        }
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "source";
        const objectPath = `${user.id}/${selectedProjectId}/${crypto.randomUUID()}-${safeName}`;
        pendingPath = objectPath;
        const { error: storageError } = await supabase.storage.from("aahana-private").upload(objectPath, file, { contentType: mimeType, upsert: false });
        if (storageError) throw new Error(`${file.name}: upload failed.`);
        const response = await fetch("/api/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objectPath, originalFilename: file.name, mimeType, sizeBytes: file.size, projectId: selectedProjectId }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Could not register ${file.name}.`);
        pendingPath = null;
        setBuildFiles((current) => [result.file, ...current]);
      }
      setBuildResult(null);
    } catch (error) {
      if (pendingPath) await supabase.storage.from("aahana-private").remove([pendingPath]).catch(() => ({}));
      setBuildError(error.message || "Source upload failed.");
      const refresh = await fetch(`/api/files?projectId=${encodeURIComponent(selectedProjectId)}`, { cache: "no-store" });
      if (refresh.ok) {
        const data = await refresh.json().catch(() => ({}));
        setBuildFiles(data.files || []);
      }
    } finally {
      setFileBusy(false);
    }
  }

  async function runBuildOperation(operation) {
    if (!selectedProjectId || buildBusy) return;
    setBuildBusy(true);
    setBuildError("");
    setBuildResult(null);
    try {
      const response = await fetch("/api/build/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId, operation }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok && result.status !== "failed") throw new Error(result.error || `Build ${operation} failed.`);
      if (result.status === "passed" || result.status === "failed") setBuildResult(result);
      else throw new Error("The Build Engine returned an incomplete execution result.");
    } catch (error) {
      setBuildError(error.message || "Build operation failed.");
    } finally {
      setBuildBusy(false);
    }
  }

  async function createBuildProject() {
    const name = window.prompt("Name your project");
    if (!name?.trim()) return;
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), project_type: "web" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not create project.");
      setBuildProjects((current) => [result.project, ...current]);
      setSelectedProjectId(result.project.id);
      setBuildResult(null);
      setBuildError("");
    } catch (error) {
      setBuildError(error.message || "Could not create project.");
    }
  }

  function tryPrompt(value) {
    setPrompt(value);
    setRequestError("");
    document.getElementById("lab-composer")?.focus();
  }

  async function previewFlow(event) {
    event.preventDefault();
    const message = prompt.trim();
    if (!message || busy) return;
    const apiMode = ({ chat: "solve", create: "create", build: "build", research: "solve", learn: "learn" })[mode] || "solve";
    setThread((current) => [...current, { role: "user", content: message }, { role: "assistant", content: "" }]);
    setPrompt("");
    setRequestError("");
    const controller = new AbortController();
    activeRequest.current = controller;
    setBusy(true);
    try {
      if (mode === "create" && requestsImage(message)) {
        const imageResponse = await fetch("/api/images/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: message }),
          signal: controller.signal,
        });
        const imageResult = await imageResponse.json().catch(() => ({}));
        if (!imageResponse.ok) throw new Error(imageResult.error || "Aahana could not generate that image.");
        if (typeof imageResult.imageDataUrl !== "string" || !imageResult.imageDataUrl.startsWith("data:image/jpeg;base64,")) {
          throw new Error("The image service returned an invalid image.");
        }
        setGeneratedImage({ dataUrl: imageResult.imageDataUrl, prompt: message });
        setThread((current) => current.map((item, index) =>
          index === current.length - 1 ? { ...item, content: "Your image is ready. It is available in this session." } : item
        ));
        return;
      }
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, mode: apiMode, conversationId }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Aahana couldn't process that request.");
      }
      const nextConversationId = response.headers.get("X-Conversation-Id");
      if (nextConversationId) setConversationId(nextConversationId);
      if (!response.body) throw new Error("Aahana's response stream was unavailable.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setThread((current) => current.map((item, index) =>
          index === current.length - 1 ? { ...item, content: answer } : item
        ));
      }
      answer += decoder.decode();
      setThread((current) => current.map((item, index) =>
        index === current.length - 1 ? { ...item, content: answer || "Aahana returned an empty response. Please try again." } : item
      ));
    } catch (error) {
      if (error.name === "AbortError") {
        setThread((current) => current.map((item, index) =>
          index === current.length - 1 && item.role === "assistant" && !item.content
            ? { ...item, content: "Response stopped." }
            : item
        ));
      } else {
        setRequestError(error.message || "Something went wrong. Please try again.");
        setThread((current) => {
          const last = current[current.length - 1];
          return last?.role === "assistant" && !last.content ? current.slice(0, -1) : current;
        });
      }
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
      setBusy(false);
    }
  }

  function stopGeneration() {
    activeRequest.current?.abort();
  }

  function startNewSession() {
    if (busy) return;
    setThread([]);
    setGeneratedImage(null);
    setConversationId(null);
    setPrompt("");
    setRequestError("");
  }

  return <main className={`experience-lab ${focus ? "focus-mode" : ""}`}>
    <div className="lab-ambient ambient-one" /><div className="lab-ambient ambient-two" />
    <header className="lab-topbar">
      <a className="lab-brand" href="/" aria-label="Aahana AI home"><span className="lab-brand-symbol">a</span><span>Aahana <i>ai</i></span></a>
      <div className="lab-top-center"><span className="live-pulse" /> INTERACTIVE EXPERIENCE LAB <span className="lab-preview-tag">AI CHAT INTEGRATION</span></div>
      <div className="lab-top-actions"><button type="button" className={focus ? "top-icon selected" : "top-icon"} onClick={() => setFocus(!focus)} aria-pressed={focus} aria-label={focus ? "Exit focus mode" : "Enter focus mode"} title="Toggle focus mode">⛶</button><a href="/" className="lab-exit">Exit preview <span>↗</span></a></div>
    </header>

    <div className="lab-layout">
      <aside className="lab-rail" aria-label="Workspace navigation">
        <button className="rail-new" type="button" onClick={startNewSession} aria-label="New session">＋</button>
        <span className="rail-separator" />
        <button className={mode === "chat" && activePanel === "tools" ? "rail-button active" : "rail-button"} type="button" title="Home" aria-label="Home" aria-current={mode === "chat" && activePanel === "tools" ? "page" : undefined} onClick={() => { setMode("chat"); startNewSession(); setActivePanel("tools"); }}>⌂</button>
        <button className={activePanel === "discover" ? "rail-button active" : "rail-button"} type="button" title="Discover" aria-pressed={activePanel === "discover"} onClick={() => setActivePanel("discover")}>✧</button>
        <button className={activePanel === "library" ? "rail-button active" : "rail-button"} type="button" title="Library" aria-pressed={activePanel === "library"} onClick={() => setActivePanel("library")}>▤</button>
        <div className="rail-bottom"><button className="rail-button" type="button" title="Settings" onClick={() => setActivePanel("settings")}>⚙</button><span className="rail-avatar">A</span></div>
      </aside>

      <section className="lab-main">
        <div className="lab-heading-row"><div><div className="lab-kicker">YOUR SPACE TO THINK BIGGER</div><h1>What shall we <span>imagine?</span></h1><p>One intelligence. Infinite ways to explore, create and build.</p></div><div className="lab-heading-orb"><OrbitMark /></div></div>

        <nav className="lab-modebar" aria-label="Choose an experience">
          {modes.map((item) => <button type="button" key={item.id} onClick={() => { setMode(item.id); setRequestError(""); }} className={mode === item.id ? "lab-mode active" : "lab-mode"} aria-pressed={mode === item.id}><span>{item.mark}</span>{item.label}</button>)}
        </nav>

        <div className="lab-workspace">
          <div className="lab-workspace-label"><span className="workspace-dot" /> {current.hint.toUpperCase()} <span className="workspace-divider">/</span> SESSION 01</div>
          {thread.length ? <div className="lab-response-card" aria-live="polite">
            {thread.map((item, index) => <div className={item.role === "user" ? "response-user" : "response-copy"} key={index}>
              {item.role === "assistant" && <div className="response-heading"><span className="response-avatar"><OrbitMark /></span><div><strong>Aahana</strong><small>{busy && index === thread.length - 1 ? "Thinking · live response" : "Aahana AI"}</small></div></div>}
              <div className="live-message-text">{item.content || (busy && index === thread.length - 1 ? "Thinking…" : "")}</div>
            </div>)}
            {generatedImage && <div className="lab-generated-image"><img src={generatedImage.dataUrl} alt={generatedImage.prompt} /><a href={generatedImage.dataUrl} download="aahana-generated-image.jpg">Download image ↗</a><small>Generated for this session · not saved to Library</small></div>}
            {requestError && <p className="live-error" role="alert">{requestError}</p>}
            <div className="response-actions"><button type="button" disabled={busy} onClick={() => tryPrompt("Go deeper and give me a practical example.")}>↳ Go deeper</button><button type="button" disabled={busy} onClick={() => tryPrompt("Challenge that answer and show another perspective.")}>◇ Challenge it</button><button type="button" disabled={busy} onClick={startNewSession}>＋ New thought</button></div>
          </div> : <div className="lab-empty">
            <div className="empty-orb"><OrbitMark /></div>
            <div className="empty-title">A thought is a beginning.</div>
            <p>Ask a question, drop an idea, attach a direction. We'll shape the next step together.</p>
          </div>}

          <form className="lab-composer" onSubmit={previewFlow}>
            <label className="sr-only" htmlFor="lab-composer">Write a message for the preview</label>
            <textarea id="lab-composer" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={mode === "build" ? "Describe the product you want to bring to life..." : mode === "create" ? "Describe the world you want to create..." : "Ask anything. Start anywhere..."} rows={3} />
            <div className="composer-controls"><div className="composer-tools"><button type="button" onClick={() => setActivePanel(activePanel === "attach" ? "tools" : "attach")} title="Add context">＋ <span>Attach</span></button><button type="button" onClick={() => setActivePanel(activePanel === "tools" ? "discover" : "tools")} title="Explore tools">◈ <span>Tools</span></button><span className="composer-divider" /><span className="composer-mode-label">{current.label} mode</span></div><div className="composer-submit"><button type="button" className="voice-button" title="Voice preview" onClick={() => setActivePanel("voice")}>◖</button>{busy ? <button type="button" className="lab-send lab-stop" onClick={stopGeneration}>Stop <span>■</span></button> : <button type="submit" className="lab-send" disabled={!prompt.trim()}>Send <span>↗</span></button>}</div></div>
          </form>
          {mode === "build" && <section className="build-console" aria-label="Project build workspace">
            <div className="build-console-heading"><div><span>PROJECT WORKSPACE</span><h2>Build and verify</h2></div><div className="build-console-heading-actions"><button type="button" onClick={() => buildFileInput.current?.click()} disabled={!selectedProjectId || fileBusy}>{fileBusy ? "Uploading…" : "＋ Add source files"}</button><button type="button" onClick={createBuildProject}>＋ New project</button><input ref={buildFileInput} type="file" multiple accept=".js,.jsx,.ts,.tsx,.mjs,.cjs,.css,.html,.htm,.json,.md,.txt,.py,.toml,.yaml,.yml,.sql" onChange={uploadBuildFiles} hidden /></div></div>
            <div className="build-console-controls">
              <label htmlFor="build-project-select">Project</label>
              <select id="build-project-select" value={selectedProjectId} onChange={(event) => { setSelectedProjectId(event.target.value); setBuildResult(null); }}>
                <option value="">Choose a project</option>
                {buildProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
              <button type="button" disabled={!selectedProjectId || buildBusy || !buildStatus?.enabled || !buildStatus?.sandboxIdentityAvailable} onClick={() => runBuildOperation("build")}>{buildBusy ? "Working…" : "Run build"}</button>
              <button type="button" disabled={!selectedProjectId || buildBusy || !buildStatus?.enabled || !buildStatus?.sandboxIdentityAvailable} onClick={() => runBuildOperation("test")}>Run tests</button>
            </div>
            {!buildStatus?.enabled && <p className="build-console-note">The isolated Build Engine is not enabled in this environment. Project selection is available, but execution is safely disabled.</p>}
            {buildStatus?.enabled && !buildStatus?.sandboxIdentityAvailable && <p className="build-console-note">Sandbox identity is not available. Execution remains unavailable until the environment is configured.</p>}
            {selectedProjectId && <div className="build-file-list"><span>PROJECT FILES {filesLoading ? "· Loading…" : `· ${buildFiles.length}`}</span>{buildFiles.length ? buildFiles.map((file) => <div key={file.id}><span>{file.original_filename}</span><small>{Math.max(1, Math.round(file.size_bytes / 1024))} KB</small>{isSupportedSourceFile(file.original_filename, file.mime_type) && <button type="button" onClick={() => openSourceEditor(file)} disabled={editorLoading}>{editorLoading ? "Opening…" : "Edit"}</button>}</div>) : !filesLoading ? <p>No files attached to this project yet. Add source files, including package.json, before running a build.</p> : null}</div>}
            {!buildProjects.length && !buildError && <p className="build-console-note">No projects yet. Create one, then add source files and a package.json in your project files.</p>}
            {editingFile && <section className="build-source-editor" aria-label={`Edit ${editingFile.original_filename}`}>
              <div><strong>{editingFile.original_filename}</strong><button type="button" onClick={() => { setEditingFile(null); setSourceDraft(""); }} disabled={editorSaving}>Close</button></div>
              <textarea aria-label={`Source code for ${editingFile.original_filename}`} spellCheck={false} value={sourceDraft} onChange={(event) => setSourceDraft(event.target.value)} />
              <button type="button" onClick={saveSourceFile} disabled={editorSaving}>{editorSaving ? "Saving…" : "Save source"}</button>
            </section>}
            {buildError && <p className="build-console-error" role="alert">{buildError}</p>}
            {buildResult && <div className="build-console-result"><strong>{buildResult.status === "passed" ? "Execution passed" : "Execution failed"} · {buildResult.operation}</strong><small>Exit code {buildResult.exitCode} · {buildResult.sourceFileCount} source files</small><pre>{[buildResult.stdout, buildResult.stderr].filter(Boolean).join("\\n") || "No output."}</pre></div>}
          </section>}
          <div className="lab-privacy-note"><span>◇</span> Your message is sent to your signed-in Aahana assistant.</div>
        </div>

        <div className="lab-suggestions-heading"><span>START WITH A SPARK</span><span>CHOOSE A DIRECTION ↘</span></div>
        <div className="lab-prompt-grid" aria-label={`${current.label} suggestions`}>{currentPrompts.map((item) => <button type="button" className="lab-prompt-card" key={item.title} onClick={() => tryPrompt(item.prompt)}><span className="prompt-mark">{item.mark}</span><span className="prompt-copy"><strong>{item.title}</strong><small>{item.detail}</small></span><span className="prompt-arrow">↗</span></button>)}</div>
      </section>

      <aside className="lab-inspector">
        <div className="inspector-head"><span>YOUR CO-PILOT</span><button type="button" onClick={() => setActivePanel("tools")} aria-label="Reset side panel">···</button></div>
        <div className="inspector-profile"><div className="inspector-orb"><OrbitMark /></div><div><strong>Aahana</strong><small>Ready to explore <span className="ready-dot" /></small></div></div>
        <div className="inspector-tabs" role="group" aria-label="Co-pilot panel"><button type="button" className={activePanel === "tools" ? "active" : ""} aria-pressed={activePanel === "tools"} onClick={() => setActivePanel("tools")}>Tools</button><button type="button" className={activePanel === "discover" ? "active" : ""} aria-pressed={activePanel === "discover"} onClick={() => setActivePanel("discover")}>Discover</button><button type="button" className={activePanel === "library" ? "active" : ""} aria-pressed={activePanel === "library"} onClick={() => setActivePanel("library")}>Library</button></div>
        <div className="inspector-content">
          {activePanel === "tools" && <><div className="inspector-section-label">CAPABILITIES</div>{[["⌘","Build workspace","Product guidance · engine in development"],["✧","Creative studio","Creative direction · media tools in development"],["⌕","Deep research","Source-backed answers when available"],["◖","Voice conversation","Voice runtime in development"]].map(([mark,title,detail]) => <button type="button" className="capability-row" key={title} onClick={() => setActivePanel(title === "Voice conversation" ? "voice" : "discover")}><span className="capability-mark">{mark}</span><span><strong>{title}</strong><small>{detail}</small></span><b>↗</b></button>)}</>}
          {activePanel === "discover" && <div className="inspector-empty"><span>✧</span><strong>Discover your next move</strong><p>Explore connected experiences from one calm, intelligent workspace.</p><button type="button" onClick={() => setMode("research")}>Explore research mode</button></div>}
          {activePanel === "library" && <div className="inspector-empty"><span>▤</span><strong>Your creative memory</strong><p>A home for saved ideas, projects and useful discoveries.</p><small>Library preview · no data stored</small></div>}
          {activePanel === "attach" && <div className="inspector-empty"><span>＋</span><strong>Bring context in</strong><p>Files, images and links can become part of the same conversation.</p><small>Attachment controls are visual only in this concept.</small></div>}
          {activePanel === "voice" && <div className="inspector-empty"><span>◖</span><strong>Voice, in the flow</strong><p>Imagine speaking, interrupting and switching between voice and text without losing context.</p><small>Voice is not connected in this preview.</small></div>}
          {activePanel === "settings" && <div className="inspector-empty"><span>⚙</span><strong>Your space, your rules</strong><p>Shape how Aahana responds, remembers and works with you.</p></div>}
        </div>
        <div className="inspector-footer"><span className="footer-spark">✳</span><div><strong>One intelligence.</strong><small>Many ways to work together.</small></div></div>
      </aside>
    </div>
    <footer className="lab-footer"><span>AAHANA AI <i>EXPERIENCE LAB</i></span><span>THINK BEYOND THE EXPECTED</span><span>AI CHAT INTEGRATION · OTHER ENGINES IN DEVELOPMENT</span></footer>
  </main>;
}
