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
        body: JSON.stringify({ message: text, mode, conversationId }),
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
        <div className="side-item active">✳ <span>Assistant</span></div>
        <div className="side-item muted">◷ <span>History</span></div>
        <div className="side-item muted">▧ <span>Projects</span></div>
        <div className="sidebar-bottom">
          <div className="avatar">A</div>
          <div className="account-copy"><strong>Your workspace</strong><small>{userEmail || "Personal"}</small></div>
          <button className="sign-out" type="button" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> Assistant</div>
          <div className="top-actions">Private workspace</div>
        </header>

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
