"use client";

import { useCallback, useEffect, useState } from "react";
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
const curricula = ["Not specified", "CBSE", "ICSE", "Karnataka State Board", "Other Indian State Board", "Cambridge International", "International Baccalaureate (IB)", "England National Curriculum", "US Common Core", "Other / help me choose"];
function readQuizPayload(content) {
  if (typeof content !== "string") return null;
  const cleaned = content.trim().replace(/^\`\`\`(?:json)?\\s*/i, "").replace(/\\s*\`\`\`$/, "");
  try {
    const value = JSON.parse(cleaned);
    if (value?.type !== "aahana_quiz_v1" || !Array.isArray(value.questions) || value.questions.length < 1 || value.questions.length > 5) return null;
    const questions = value.questions.filter((item) =>
      typeof item?.question === "string" && item.question.trim() &&
      Array.isArray(item.options) && item.options.length === 4 &&
      item.options.every((option) => typeof option === "string" && option.trim()) &&
      new Set(item.options).size === 4 &&
      Number.isInteger(item.correctIndex) && item.correctIndex >= 0 && item.correctIndex < 4 &&
      typeof item.explanation === "string" && item.explanation.trim()
    );
    if (questions.length !== value.questions.length) return null;
    return { title: typeof value.title === "string" ? value.title : "Quick challenge", questions };
  } catch {
    return null;
  }
}

function InteractiveQuiz({ quiz }) {
  const [answers, setAnswers] = useState({});
  const completed = quiz.questions.every((_, index) => Number.isInteger(answers[index]));
  const score = quiz.questions.reduce((total, item, index) => total + (answers[index] === item.correctIndex ? 1 : 0), 0);
  return (
    <div className="learning-quiz">
      <div className="learning-quiz-heading"><strong>{quiz.title}</strong><span>{completed ? `Score: ${score}/${quiz.questions.length}` : `${Object.keys(answers).length}/${quiz.questions.length} answered`}</span></div>
      {quiz.questions.map((item, index) => {
        const selected = answers[index];
        return <section className="learning-quiz-question" key={index}>
          <h3>{index + 1}. {item.question}</h3>
          <div className="learning-quiz-options">
            {item.options.map((option, optionIndex) => <button type="button" key={optionIndex} disabled={Number.isInteger(selected)} className={Number.isInteger(selected) && optionIndex === item.correctIndex ? "correct" : Number.isInteger(selected) && selected === optionIndex ? "incorrect" : ""} onClick={() => setAnswers((current) => ({ ...current, [index]: optionIndex }))}>
              <span>{String.fromCharCode(65 + optionIndex)}</span>{option}
            </button>)}
          </div>
          {Number.isInteger(selected) && <p className={selected === item.correctIndex ? "learning-quiz-feedback correct" : "learning-quiz-feedback incorrect"}>{selected === item.correctIndex ? "Correct. " : "Not quite. "}{item.explanation}</p>}
        </section>;
      })}
      {completed && <div className="learning-quiz-finish"><strong>{score === quiz.questions.length ? "Excellent work!" : "Good effort — every question is a chance to learn."}</strong><button type="button" onClick={() => setAnswers({})}>Try again</button></div>}
    </div>
  );
}


export default function LearningStudio({ userEmail = "" }) {
  const [gradeBand, setGradeBand] = useState("not-sure");
  const [subject, setSubject] = useState("Anything / explore");
  const [curriculum, setCurriculum] = useState("Not specified");
  const [language, setLanguage] = useState("Use my language");
  const [learningMode, setLearningMode] = useState("story");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [loadingConversationId, setLoadingConversationId] = useState(null);

  const loadLearningHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const response = await fetch("/api/conversations", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not load learning history.");
      setHistory((result.conversations || []).filter((item) => item.mode === "learn"));
    } catch (err) {
      setHistoryError(err.message || "Could not load learning history.");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { loadLearningHistory(); }, [loadLearningHistory]);

  async function resumeLearning(id) {
    if (busy || loadingConversationId) return;
    setLoadingConversationId(id);
    setError("");
    try {
      const response = await fetch("/api/conversations/" + encodeURIComponent(id), { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not reopen this learning session.");
      if (result.conversation?.mode !== "learn") throw new Error("This conversation is not a Learning Studio session.");
      setConversationId(result.conversation.id);
      try {
        const savedProfile = JSON.parse(window.localStorage.getItem("aahana:learning-profile:" + result.conversation.id) || "null");
        if (savedProfile && typeof savedProfile === "object") {
          if (gradeBands.some(([value]) => value === savedProfile.gradeBand)) setGradeBand(savedProfile.gradeBand);
          if (subjects.includes(savedProfile.subject)) setSubject(savedProfile.subject);
          if (curricula.includes(savedProfile.curriculum)) setCurriculum(savedProfile.curriculum);
          if (typeof savedProfile.language === "string" && savedProfile.language.length <= 35) setLanguage(savedProfile.language);
          if (learningModes.some((item) => item.id === savedProfile.learningMode)) setLearningMode(savedProfile.learningMode);
        }
      } catch {
        // A missing or malformed local profile does not block reopening the conversation.
      }
      setMessages((result.messages || []).map((item) => ({ role: item.role, content: item.content || "" })));
      setQuestion("");
    } catch (err) {
      setError(err.message || "Could not reopen this learning session.");
    } finally {
      setLoadingConversationId(null);
    }
  }

  async function startLearning(event) {
    event.preventDefault();
    const requestText = question.trim();
    if (!requestText || busy) return;
    const profile = { gradeBand, subject, curriculum, language, learningMode };
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
      if (nextId) {
        setConversationId(nextId);
        try {
          window.localStorage.setItem("aahana:learning-profile:" + nextId, JSON.stringify(profile));
        } catch {
          // The conversation still works if this device cannot store preferences.
        }
      }
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
      await loadLearningHistory();
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
          <label>Curriculum / education board
            <select value={curriculum} onChange={(event) => setCurriculum(event.target.value)} disabled={busy}>
              {curricula.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>Learning language
            <input value={language} onChange={(event) => setLanguage(event.target.value.slice(0, 35))} maxLength={35} disabled={busy} placeholder="e.g. ಕನ್ನಡ, हिन्दी, English" aria-label="Learning language" />
          </label>
        </div>
      </section>

      <section className="learning-history" aria-label="Previous learning sessions">
        <div className="learning-section-heading"><div><span>YOUR PROGRESS</span><h2>Pick up where you left off</h2></div><button type="button" onClick={loadLearningHistory} disabled={historyLoading}>Refresh</button></div>
        {historyLoading ? <p className="learning-history-empty">Loading your learning sessions…</p>
          : historyError ? <p className="learning-error" role="alert">{historyError}</p>
          : history.length === 0 ? <p className="learning-history-empty">Your learning sessions will appear here after your first lesson.</p>
          : <div className="learning-history-list">{history.map((item) => <button type="button" className={conversationId === item.id ? "learning-history-item current" : "learning-history-item"} key={item.id} onClick={() => resumeLearning(item.id)} disabled={busy || Boolean(loadingConversationId)}>
              <span><strong>{item.title || "Learning session"}</strong><small>{new Date(item.updated_at).toLocaleString()}</small></span>
              <em>{loadingConversationId === item.id ? "Opening…" : conversationId === item.id ? "Open" : "Resume"}</em>
            </button>)}</div>}
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
            {item.content ? (learningMode === "play" && item.role === "assistant" && readQuizPayload(item.content)
              ? <InteractiveQuiz quiz={readQuizPayload(item.content)} />
              : <p>{item.content}</p>) : <div className="learning-thinking"><i /><i /><i /> Preparing your lesson</div>}
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
