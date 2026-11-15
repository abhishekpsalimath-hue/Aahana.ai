"use client";

import { useState } from "react";

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

export default function Home() {
  const [mode, setMode] = useState("solve");
  const [prompt, setPrompt] = useState("");

  function submitPrompt(event) {
    event.preventDefault();
    if (!prompt.trim()) return;
    // AI requests are intentionally not sent until the authenticated,
    // rate-limited server route has been connected and tested.
    setPrompt(prompt.trim());
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Aahana home">
          <span className="brand-mark">a</span>
          <span> aahana</span>
        </a>
        <button className="new-chat" type="button" onClick={() => setPrompt("")}>
          <span aria-hidden="true">＋</span> New conversation
        </button>
        <div className="side-label">WORKSPACE</div>
        <div className="side-item active">✳ <span>Assistant</span></div>
        <div className="side-item muted">◷ <span>History</span></div>
        <div className="side-item muted">▧ <span>Projects</span></div>
        <div className="sidebar-bottom">
          <div className="avatar">A</div>
          <div><strong>Your workspace</strong><small>Personal</small></div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> Assistant</div>
          <div className="top-actions"><span className="status-dot" /> Preview workspace</div>
        </header>

        <div className="welcome">
          <div className="eyebrow"><span /> YOUR THINKING SPACE</div>
          <h1>Good ideas start<br /><em>somewhere.</em></h1>
          <p>Bring a question, a challenge, or an idea.<br className="desktop-break" /> We’ll shape the next step together.</p>

          <div className="mode-row" role="tablist" aria-label="Choose a mode">
            {modes.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={mode === item.id}
                className={mode === item.id ? "mode active-mode" : "mode"}
                onClick={() => setMode(item.id)}>
                {item.label}
              </button>
            ))}
          </div>

          <form className="composer" onSubmit={submitPrompt}>
            <label className="sr-only" htmlFor="prompt">What would you like to work on?</label>
            <textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)}
              placeholder="What would you like to work on today?" rows={3} />
            <div className="composer-footer">
              <span className="composer-mode">{modes.find((item) => item.id === mode)?.hint}</span>
              <button className="send" type="submit" disabled={!prompt.trim()} aria-label="Submit prompt">↑</button>
            </div>
          </form>
          <div className="notice">AI responses are being connected. Your prompt is not sent or stored yet.</div>

          <div className="starter-grid">
            {starters.map((item, index) => (
              <button className="starter" type="button" key={item} onClick={() => setPrompt(item)}>
                <span className="starter-icon">{["◇", "↗", "✎", "⌘"][index]}</span>
                <span>{item}</span>
                <span className="starter-arrow">↗</span>
              </button>
            ))}
          </div>
        </div>
        <footer className="footer"><span>AAHANA</span><span>Thoughtfully made for what’s next.</span></footer>
      </section>
    </main>
  );
}
