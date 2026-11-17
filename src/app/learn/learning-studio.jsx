"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import "./learning-studio.css";
import AnimatedLesson, { AnimatedVisual, readMotionLesson } from "./animated-lesson";

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
  const cleaned = content.trim().replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const value = JSON.parse(cleaned);
    if (value?.type !== "aahana_quiz_v1" || !Array.isArray(value.questions) || value.questions.length < 1 || value.questions.length > 5) return null;
    const questions = value.questions.filter((item) =>
      typeof item?.question === "string" && item.question.trim() &&
      Array.isArray(item.options) && item.options.length === 4 &&
      item.options.every((option) => typeof option === "string" && option.trim()) &&
      new Set(item.options).size === 4 &&
      Number.isInteger(item.correctIndex) && item.correctIndex >= 0 && item.correctIndex < 4 &&
      typeof item.explanation === "string" && item.explanation.trim() &&
      typeof item.hint === "string" && item.hint.trim() &&
      ["fraction", "orbit", "water-cycle", "plant-growth", "number-line", "molecule", "concept-map"].includes(item.visual)
    );
    if (questions.length !== value.questions.length) return null;
    return { title: typeof value.title === "string" ? value.title : "A little challenge", questions };
  } catch {
    return null;
  }
}

function InteractiveQuiz({ quiz }) {
  const [answers, setAnswers] = useState({});
  const [attempts, setAttempts] = useState({});
  const completed = quiz.questions.every((_, index) => answers[index] === quiz.questions[index].correctIndex);
  const score = quiz.questions.reduce((total, item, index) => total + (answers[index] === item.correctIndex ? 1 : 0), 0);
  function choose(index, optionIndex) {
    if (Number.isInteger(answers[index])) return;
    setAttempts((current) => ({ ...current, [index]: (current[index] || 0) + 1 }));
    if (optionIndex === quiz.questions[index].correctIndex) {
      setAnswers((current) => ({ ...current, [index]: optionIndex }));
    }
  }
  function retry(index) {
    setAttempts((current) => ({ ...current, [index]: 0 }));
  }
  return (
    <div className="learning-quiz">
      <div className="learning-quiz-heading"><strong>{quiz.title}</strong><span>{completed ? "Challenge complete!" : `${score}/${quiz.questions.length} discovered`}</span></div>
      <div className="learning-quiz-progress" aria-label={`${score} of ${quiz.questions.length} questions solved`}><span style={{ width: `${(score / quiz.questions.length) * 100}%` }} /></div>
      {quiz.questions.map((item, index) => {
        const selected = answers[index];
        const tries = attempts[index] || 0;
        const solved = selected === item.correctIndex;
        return <section className={solved ? "learning-quiz-question solved" : "learning-quiz-question"} key={index}>
          <div className="learning-quiz-question-top"><span>CHALLENGE {index + 1}</span>{solved && <span className="learning-quiz-sparkle">✦ Nice discovery!</span>}</div>
          <h3>{item.question}</h3>
          <AnimatedVisual visual={item.visual} />
          <div className="learning-quiz-options">
            {item.options.map((option, optionIndex) => <button type="button" key={optionIndex} disabled={solved} className={solved && optionIndex === item.correctIndex ? "correct" : ""} onClick={() => choose(index, optionIndex)}>
              <span>{String.fromCharCode(65 + optionIndex)}</span>{option}
            </button>)}
          </div>
          {solved && <div className="learning-quiz-feedback correct"><strong>You figured it out!</strong><p>{item.explanation}</p></div>}
          {!solved && tries > 0 && <div className="learning-quiz-feedback encouraging"><strong>Good exploring! Every try helps your brain make a new connection.</strong><p>Here's a little clue: {item.hint}</p><button type="button" onClick={() => retry(index)}>I'll try again</button></div>}
        </section>;
      })}
      {completed && <div className="learning-quiz-finish"><span className="learning-celebration" aria-hidden="true">✦ ✧ ★ ✧ ✦</span><strong>You did it! You solved all {quiz.questions.length} challenges.</strong><button type="button" onClick={() => { setAnswers({}); setAttempts({}); }}>Play again</button></div>}
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

  const [learningMemory, setLearningMemory] = useState({ enabled: false, journeys: [] });
  const [memoryLoading, setMemoryLoading] = useState(true);
  const [memoryBusy, setMemoryBusy] = useState(false);
  const [memoryError, setMemoryError] = useState("");
  const [memoryNotice, setMemoryNotice] = useState("");

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


  const loadLearningMemory = useCallback(async () => {
    setMemoryLoading(true);
    setMemoryError("");
    try {
      const response = await fetch("/api/learning-journey", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not load your learning journey.");
      setLearningMemory({ enabled: result.enabled === true, journeys: result.journeys || [] });
    } catch (err) {
      setMemoryError(err.message || "Could not load your learning journey.");
    } finally {
      setMemoryLoading(false);
    }
  }, []);

  useEffect(() => { loadLearningHistory(); loadLearningMemory(); }, [loadLearningHistory, loadLearningMemory]);

  async function updateLearningMemoryConsent() {
    if (memoryBusy) return;
    setMemoryBusy(true);
    setMemoryError("");
    setMemoryNotice("");
    try {
      const action = learningMemory.enabled ? "disable" : "enable";
      const response = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not update private memory.");
      await loadLearningMemory();
      setMemoryNotice(action === "enable"
        ? "Private learning memory is on. You choose which completed journeys to save."
        : "Private learning memory is off. Existing saved journeys remain available until you delete them.");
    } catch (err) {
      setMemoryError(err.message || "Could not update private memory.");
    } finally {
      setMemoryBusy(false);
    }
  }

  const saveLearningJourney = useCallback(async (journey) => {
    setMemoryError("");
    setMemoryNotice("");
    try {
      const response = await fetch("/api/learning-journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journey: { ...journey, subject, gradeBand, curriculum, language } }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not save this learning journey.");
      await loadLearningMemory();
      setMemoryNotice("Saved to your private learning journey.");
      return true;
    } catch (err) {
      setMemoryError(err.message || "Could not save this learning journey.");
      return false;
    }
  }, [subject, gradeBand, curriculum, language, loadLearningMemory]);

  async function deleteLearningJourney(id) {
    if (!id || memoryBusy) return;
    setMemoryBusy(true);
    setMemoryError("");
    setMemoryNotice("");
    try {
      const response = await fetch("/api/learning-journey?id=" + encodeURIComponent(id), { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not delete this learning journey.");
      setLearningMemory((current) => ({ ...current, journeys: current.journeys.filter((item) => item.id !== id) }));
      setMemoryNotice("That learning journey was deleted.");
    } catch (err) {
      setMemoryError(err.message || "Could not delete this learning journey.");
    } finally {
      setMemoryBusy(false);
    }
  }

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

      <section className="learning-journey" aria-label="My learning journey">
        <div className="learning-section-heading">
          <div><span>YOUR PRIVATE LEARNING MEMORY</span><h2>My learning journey</h2></div>
          <button type="button" onClick={updateLearningMemoryConsent} disabled={memoryBusy || memoryLoading}>
            {memoryBusy ? "Updating…" : learningMemory.enabled ? "Turn memory off" : "Turn memory on"}
          </button>
        </div>
        <p className="learning-journey-intro">Aahana can remember completed animated lessons you choose to save. It records topics and learning paths—not grades or intelligence. Your saved journeys are private to your account, and you can delete them here.</p>
        {memoryLoading ? <p className="learning-history-empty">Checking your private learning memory…</p>
          : memoryError ? <p className="learning-error" role="alert">{memoryError}</p>
          : <p className="learning-memory-status">{learningMemory.enabled ? "Private memory is on. Saving a lesson is always your choice." : "Private memory is off. Turn it on only if you want Aahana to remember saved learning journeys."}</p>}
        {memoryNotice && <p className="learning-memory-notice" role="status">{memoryNotice}</p>}
        {learningMemory.journeys.length > 0 && <div className="learning-journey-list">
          {learningMemory.journeys.map((item) => <article className="learning-journey-item" key={item.id}>
            <div><strong>{item.journey.title}</strong><span>{item.journey.subject} · {item.journey.gradeBand} · {item.journey.language}</span>
              <small>{new Date(item.createdAt).toLocaleDateString()} · {item.journey.exploredScenes} scenes explored · {item.journey.attempts} attempts · {item.journey.adaptedScenes} alternate explanations</small>{item.journey.scenes?.some((scene) => scene.alternateExplanationUsed) && <small>Explore again: {item.journey.scenes.filter((scene) => scene.alternateExplanationUsed).map((scene) => scene.caption).join(", ")}</small>}</div>
            <button type="button" onClick={() => deleteLearningJourney(item.id)} disabled={memoryBusy}>Delete</button>
          </article>)}
        </div>}
        {!memoryLoading && learningMemory.journeys.length === 0 && <p className="learning-history-empty">No saved journeys yet. Finish an animated lesson and choose “Save to my journey”.</p>}
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
              : learningMode === "play" && item.role === "assistant" && busy && index === messages.length - 1
                ? <div className="learning-thinking"><i /><i /><i /> Building your quiz</div>
                : readMotionLesson(item.content)
                ? <AnimatedLesson content={item.content} memoryEnabled={learningMemory.enabled} onSaveJourney={saveLearningJourney} />
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
