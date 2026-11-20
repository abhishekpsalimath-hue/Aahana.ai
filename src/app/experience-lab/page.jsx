"use client";

import { useState } from "react";
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

const sampleResponses = {
  chat: "Let's open this up from three angles: what you believe, what the evidence says, and what might surprise you. Start with the outcome you want most.",
  create: "A strong visual direction starts with a feeling. Let's define the subject, atmosphere, palette and camera language before creating the first frame.",
  build: "Let's shape the product in layers: the user problem, the core journey, the system architecture and a small testable first release.",
  research: "I'll structure the exploration around primary evidence, competing explanations, unknowns and a concise set of findings to verify.",
  learn: "We'll build intuition first, then connect the concepts, test your understanding and increase the difficulty at your pace.",
};

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
  const [sample, setSample] = useState(false);
  const [focus, setFocus] = useState(false);
  const [activePanel, setActivePanel] = useState("tools");
  const current = modes.find((item) => item.id === mode) || modes[0];

  function tryPrompt(value) {
    setPrompt(value);
    setSample(false);
    document.getElementById("lab-composer")?.focus();
  }

  function previewFlow(event) {
    event.preventDefault();
    if (!prompt.trim()) return;
    setSample(true);
  }

  return <main className={`experience-lab ${focus ? "focus-mode" : ""}`}>
    <div className="lab-ambient ambient-one" /><div className="lab-ambient ambient-two" />
    <header className="lab-topbar">
      <a className="lab-brand" href="/" aria-label="Aahana AI home"><span className="lab-brand-symbol">a</span><span>Aahana <i>ai</i></span></a>
      <div className="lab-top-center"><span className="live-pulse" /> INTERACTIVE EXPERIENCE LAB <span className="lab-preview-tag">CONCEPT</span></div>
      <div className="lab-top-actions"><button type="button" className={focus ? "top-icon selected" : "top-icon"} onClick={() => setFocus(!focus)} aria-pressed={focus} title="Toggle focus mode">⛶</button><a href="/" className="lab-exit">Exit preview <span>↗</span></a></div>
    </header>

    <div className="lab-layout">
      <aside className="lab-rail" aria-label="Workspace navigation">
        <button className="rail-new" type="button" onClick={() => { setPrompt(""); setSample(false); }} aria-label="New session">＋</button>
        <span className="rail-separator" />
        <button className="rail-button active" type="button" title="Home">⌂</button>
        <button className="rail-button" type="button" title="Discover" onClick={() => setActivePanel("discover")}>✧</button>
        <button className="rail-button" type="button" title="Library" onClick={() => setActivePanel("library")}>▤</button>
        <div className="rail-bottom"><button className="rail-button" type="button" title="Settings" onClick={() => setActivePanel("settings")}>⚙</button><span className="rail-avatar">A</span></div>
      </aside>

      <section className="lab-main">
        <div className="lab-heading-row"><div><div className="lab-kicker">YOUR SPACE TO THINK BIGGER</div><h1>What shall we <span>imagine?</span></h1><p>One intelligence. Infinite ways to explore, create and build.</p></div><div className="lab-heading-orb"><OrbitMark /></div></div>

        <nav className="lab-modebar" aria-label="Choose an experience">
          {modes.map((item) => <button type="button" key={item.id} onClick={() => { setMode(item.id); setSample(false); }} className={mode === item.id ? "lab-mode active" : "lab-mode"} aria-pressed={mode === item.id}><span>{item.mark}</span>{item.label}</button>)}
        </nav>

        <div className="lab-workspace">
          <div className="lab-workspace-label"><span className="workspace-dot" /> {current.hint.toUpperCase()} <span className="workspace-divider">/</span> SESSION 01</div>
          {sample ? <div className="lab-response-card">
            <div className="response-heading"><span className="response-avatar"><OrbitMark /></span><div><strong>Aahana</strong><small>Sample interaction · not connected to AI</small></div><button type="button" onClick={() => setSample(false)} aria-label="Close sample response">×</button></div>
            <div className="response-user">{prompt}</div><div className="response-copy">{sampleResponses[mode]}</div>
            <div className="response-actions"><button type="button" onClick={() => tryPrompt("Go deeper and give me a practical example.")}>↳ Go deeper</button><button type="button" onClick={() => tryPrompt("Challenge that answer and show another perspective.")}>◇ Challenge it</button><button type="button" onClick={() => setSample(false)}>＋ New thought</button></div>
          </div> : <div className="lab-empty">
            <div className="empty-orb"><OrbitMark /></div>
            <div className="empty-title">A thought is a beginning.</div>
            <p>Ask a question, drop an idea, attach a direction. We'll shape the next step together.</p>
          </div>}

          <form className="lab-composer" onSubmit={previewFlow}>
            <label className="sr-only" htmlFor="lab-composer">Write a message for the preview</label>
            <textarea id="lab-composer" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={mode === "build" ? "Describe the product you want to bring to life..." : mode === "create" ? "Describe the world you want to create..." : "Ask anything. Start anywhere..."} rows={3} />
            <div className="composer-controls"><div className="composer-tools"><button type="button" onClick={() => setActivePanel(activePanel === "attach" ? "tools" : "attach")} title="Add context">＋ <span>Attach</span></button><button type="button" onClick={() => setActivePanel(activePanel === "tools" ? "discover" : "tools")} title="Explore tools">◈ <span>Tools</span></button><span className="composer-divider" /><span className="composer-mode-label">{current.label} mode</span></div><div className="composer-submit"><button type="button" className="voice-button" title="Voice preview" onClick={() => setActivePanel("voice")}>◖</button><button type="submit" className="lab-send" disabled={!prompt.trim()}>Explore <span>↗</span></button></div></div>
          </form>
          <div className="lab-privacy-note"><span>◇</span> Your ideas stay yours. You are in a visual concept preview.</div>
        </div>

        <div className="lab-suggestions-heading"><span>START WITH A SPARK</span><span>CHOOSE A DIRECTION ↘</span></div>
        <div className="lab-prompt-grid">{prompts.map((item) => <button type="button" className="lab-prompt-card" key={item.title} onClick={() => { setMode(item.title === "Make a visual" ? "create" : item.title === "Build something" ? "build" : item.title === "Find the signal" ? "research" : "chat"); tryPrompt(item.prompt); }}><span className="prompt-mark">{item.mark}</span><span className="prompt-copy"><strong>{item.title}</strong><small>{item.detail}</small></span><span className="prompt-arrow">↗</span></button>)}</div>
      </section>

      <aside className="lab-inspector">
        <div className="inspector-head"><span>YOUR CO-PILOT</span><button type="button" onClick={() => setActivePanel("tools")} aria-label="Reset side panel">···</button></div>
        <div className="inspector-profile"><div className="inspector-orb"><OrbitMark /></div><div><strong>Aahana</strong><small>Ready to explore <span className="ready-dot" /></small></div></div>
        <div className="inspector-tabs"><button type="button" className={activePanel === "tools" ? "active" : ""} onClick={() => setActivePanel("tools")}>Tools</button><button type="button" className={activePanel === "discover" ? "active" : ""} onClick={() => setActivePanel("discover")}>Discover</button><button type="button" className={activePanel === "library" ? "active" : ""} onClick={() => setActivePanel("library")}>Library</button></div>
        <div className="inspector-content">
          {activePanel === "tools" && <><div className="inspector-section-label">CAPABILITIES</div>{[["⌘","Build workspace","Code, preview and iterate"],["✧","Creative studio","Visuals, motion and ideas"],["⌕","Deep research","Sources, synthesis and insight"],["◖","Voice conversation","Speak naturally, hands-free"]].map(([mark,title,detail]) => <button type="button" className="capability-row" key={title} onClick={() => setActivePanel(title === "Voice conversation" ? "voice" : "discover")}><span className="capability-mark">{mark}</span><span><strong>{title}</strong><small>{detail}</small></span><b>↗</b></button>)}</>}
          {activePanel === "discover" && <div className="inspector-empty"><span>✧</span><strong>Discover your next move</strong><p>Explore connected experiences from one calm, intelligent workspace.</p><button type="button" onClick={() => setMode("research")}>Explore research mode</button></div>}
          {activePanel === "library" && <div className="inspector-empty"><span>▤</span><strong>Your creative memory</strong><p>A home for saved ideas, projects and useful discoveries.</p><small>Library preview · no data stored</small></div>}
          {activePanel === "attach" && <div className="inspector-empty"><span>＋</span><strong>Bring context in</strong><p>Files, images and links can become part of the same conversation.</p><small>Attachment controls are visual only in this concept.</small></div>}
          {activePanel === "voice" && <div className="inspector-empty"><span>◖</span><strong>Voice, in the flow</strong><p>Imagine speaking, interrupting and switching between voice and text without losing context.</p><small>Voice is not connected in this preview.</small></div>}
          {activePanel === "settings" && <div className="inspector-empty"><span>⚙</span><strong>Your space, your rules</strong><p>Shape how Aahana responds, remembers and works with you.</p></div>}
        </div>
        <div className="inspector-footer"><span className="footer-spark">✳</span><div><strong>One intelligence.</strong><small>Many ways to work together.</small></div></div>
      </aside>
    </div>
    <footer className="lab-footer"><span>AAHANA AI <i>EXPERIENCE LAB</i></span><span>THINK BEYOND THE EXPECTED</span><span>CONCEPT BUILD · INTERACTIONS ARE LOCAL ONLY</span></footer>
  </main>;
}
