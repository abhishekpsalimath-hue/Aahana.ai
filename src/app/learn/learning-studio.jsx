"use client";

import { useState } from "react";
import Link from "next/link";
import "./learning-studio.css";

const learningModes = [
  { id: "story", title: "Story Mode", icon: "✦", detail: "Turn a difficult idea into a memorable story.", prompt: "Teach me through a vivid, age-appropriate story. Introduce the concept naturally, then connect each part of the story to the real idea." },
  { id: "visual", title: "Visual Explainer", icon: "◉", detail: "Use diagrams, comparisons and visual thinking.", prompt: "Teach this visually using simple labelled text diagrams, spatial descriptions, comparisons and step-by-step visual breakdowns. Keep every visual scientifically or mathematically accurate." },
  { id: "play", title: "Play & Solve", icon: "◇", detail: "Learn by solving small challenges.", prompt: "Turn this into an interactive practice session. Give me one small challenge at a time, wait for my answer, then explain the reasoning and adapt the next challenge." },
  { id: "adventure", title: "Adventure Mode", icon: "↗", detail: "Explore a topic through missions and discovery.", prompt: "Create a short learning adventure with a clear mission, stages, choices and knowledge checks. Make progress feel rewarding, but never let game mechanics replace accurate teaching." },
  { id: "talk", title: "Talk & Learn", icon: "◎", detail: "Ask questions and explore ideas together.", prompt: "Be my patient conversation tutor. Ask one useful question at a time, follow my curiosity, check what I understand and explain without overwhelming me." },
  { id: "experiment", title: "Create & Experiment", icon: "⌁", detail: "Explore through experiments and making.", prompt: "Help me learn by designing a safe, practical experiment or creative project. State materials, steps, what to observe, why it happens and any safety precautions. If a real experiment is unsuitable, use a thought experiment or simulation." },
];

const gradeBands = [
  ["primary", "Primary school"],
  ["middle", "Middle school"],
  ["secondary", "Secondary school"],
  ["higher-secondary", "Higher secondary"],
  ["college", "College / university"],
  ["adult", "Independent learner"],
  ["not-sure", "Help me choose my level"],
];

const subjects = ["Anything / explore", "Mathematics", "Science", "Physics", "Chemistry", "Biology", "History", "Geography", "Civics", "English", "Languages", "Computer science", "Technology & AI", "Economics", "Arts & creativity", "Everyday skills"];

export default function LearningStudio({ userEmail = "" }) {
  const [gradeBand, setGradeBand] = useState("not-sure");
  const [subject, setSubject] = useState("Anything / explore");
  const [language, setLanguage] = useState("Use my language");
  const [learningMode, setLearningMode] = useState("story");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function startLearning(event) {
    event.preventDefault();
    const requestText = question.trim();
    if (!requestText || busy) return;
    const selectedMode = learningModes.find((item) => item.id === learningMode);
    const profile = { gradeBand, subject, language, learningMode };
    setQuestion("");
    setError("");
    setBusy(true);
    setMessages((items) => [...items, { role: "user", content: requestText }, { role: "assistant", content: "" }]);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: requestText,
          mode: "learn",
          conversationId,
          learningProfile: profile,
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Aahana could not start this learning session.");
      }
      const nextId = response.headers.get("X-Conversation-Id");
      if (nextId) setConversationId(nextId);
      if (!response.body) throw new Error("The learning response was unavailable.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages((items) => items.map((item, index) => index === items.length - 1 ? { ...item, content: answer } : item));
      }
      answer += decoder.decode();
      setMessages((items) => items.map((item, index) => index === items.length - 1 ? { ...item, content: answer || "Let's try that question again." } : item));
    } catch (err) {
      setError(err.message || "Something interrupted this learning session.");
      setMessages((items) => items[items.length - 1]?.role === "assistant" && !items[items.length - 1].content ? items.slice(0, -1) : items);
    } finally {
      setBusy(false);
    }
  }

  function resetSession() {
    if (busy) return;
    setMessages([]);
    setConversationId(null);
    setQuestion("");
    setError("");
  }

  return (
    <main className="learning-page">
      <header className="learning-header">
        <Link className="learning-brand" href="/">Aahana <span>ai</span></Link>
        <nav><Link href="/">Assistant</Link><span className="learning-user">{userEmail || "Your workspace"}</span></nav>
      </header>

      <section className="learning-hero">
        <div className="learning-kicker">Aahana Learning Studio</div>
        <h1>Curiosity looks good<br /><em>on you.</em></h1>
        <p>Explore ideas, ask anything and learn in a way that makes sense to you. No pressure to know the answer before you begin.</p>
      </section>

      <section className="learning-profile" aria-label="Personalise your learning">
        <div className="learning-section-heading"><div><span>YOUR LEARNING SPACE</span><h2>Let’s make this yours</h2></div><button type="button" onClick={resetSession} disabled={busy}>New session</button></div>
        <div className="learning-select-grid">
          <label>Learning level
            <select value={gradeBand} onChange={(event) => setGradeBand(event.target.value)} disabled={busy}>
              {gradeBands.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
          <label>What are you exploring?
            <select value={subject} onChange={(event) => setSubject(event.target.value)} disabled={busy}>
              {subjects.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>Learning language
            <input value={language} onChange={(event) => setLanguage(event.target.value.slice(0, 35))} maxLength={35} disabled={busy} aria-label="Learning language" />
          </label>
        </div>
      </section>

      <section className="learning-modes">
        <div className="learning-section-heading"><div><span>CHOOSE YOUR JOURNEY</span><h2>How would you like to learn?</h2></div></div>
        <div className="learning-mode-grid">
          {learningModes.map((item) => (
            <button key={item.id} type="button" className={learningMode === item.id ? "learning-mode-card selected" : "learning-mode-card"} onClick={() => setLearningMode(item.id)} aria-pressed={learningMode === item.id} disabled={busy}>
              <span className="learning-mode-icon" aria-hidden="true">{item.icon}</span>
              <strong>{item.title}</strong><span>{item.detail}</span>
              <small>{learningMode === item.id ? "Selected" : "Choose this mode"}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="learning-session">
        <div className="learning-section-heading"><div><span>LET’S BEGIN</span><h2>Your learning conversation</h2></div><span className="learning-session-status">{busy ? "Aahana is thinking…" : "Ready when you are"}</span></div>
        {messages.length > 0 && <div className="learning-conversation" aria-live="polite">
          {messages.map((item, index) => <article className={item.role === "user" ? "learning-message learner" : "learning-message tutor"} key={index}>
            <small>{item.role === "user" ? "YOU" : "AAHANA"}</small>
            {item.content ? <p>{item.content}</p> : <div className="learning-thinking"><i /><i /><i /> Preparing your lesson</div>}
          </article>)}
        </div>}
        <form className="learning-composer" onSubmit={startLearning}>
          <label htmlFor="learning-question">What would you like to understand today?</label>
          <textarea id="learning-question" value={question} onChange={(event) => setQuestion(event.target.value)} rows={3} maxLength={8000} disabled={busy} placeholder="For example: Why does the Moon look bigger near the horizon? Or teach me fractions using pizza…" />
          <div><span>{learningModes.find((item) => item.id === learningMode)?.detail}</span><button type="submit" disabled={!question.trim() || busy}>{busy ? "Learning…" : "Start learning"}</button></div>
        </form>
        {error && <p className="learning-error" role="alert">{error}</p>}
        <p className="learning-note">Aahana keeps explanations in text. Visual diagrams, experiments and generated media are offered only when the required capability is actually available.</p>
      </section>
      <footer className="learning-footer"><span>Aahana Learning Studio</span><span>Wonder first. Understanding follows.</span></footer>
    </main>
  );
}
