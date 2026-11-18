"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import "./learning-studio.css";
import AnimatedLesson, { AnimatedVisual, readMotionLesson } from "./animated-lesson";
import { learningCategories, allLearningSubjects } from "@/lib/learning/learning-catalog";
const Interactive3DWorld = dynamic(() => import("./interactive-3d-world"), { ssr: false, loading: () => <div role="status">Preparing interactive 3D learning…</div> });
const Mini3DModel = dynamic(() => import("./interactive-3d-world").then((module) => module.Mini3DModel), { ssr: false });

const subjects = allLearningSubjects;
const curricula = ["Not specified", "CBSE", "ICSE", "Karnataka State Board", "Other Indian State Board", "Cambridge International", "International Baccalaureate (IB)", "England National Curriculum", "US Common Core", "Other / help me choose"];

const learningModes = [
  { id: "story", title: "Story Mode", icon: "✦", detail: "Turn a difficult idea into a memorable story.", prompt: "Teach me through a vivid, age-appropriate story. Introduce the concept naturally, then connect each part of the story to the real idea." },
  { id: "visual", title: "Visual Explainer", icon: "◉", detail: "Use diagrams, comparisons and visual thinking.", prompt: "Teach this visually using simple labelled text diagrams, spatial descriptions, comparisons and step-by-step visual breakdowns. Keep every visual scientifically or mathematically accurate." },
  { id: "play", title: "Play & Solve", icon: "◇", detail: "Learn by solving small challenges.", prompt: "Turn this into an interactive practice session. Give me one small challenge at a time, wait for my answer, then explain the reasoning and adapt the next challenge." },
  { id: "adventure", title: "Adventure Mode", icon: "↗", detail: "Explore a topic through missions and discovery.", prompt: "Create a short learning adventure with a clear mission, stages, choices and knowledge checks. Make progress feel rewarding, but never let game mechanics replace accurate teaching." },
  { id: "talk", title: "Talk & Learn", icon: "◎", detail: "Ask questions and explore ideas together.", prompt: "Be my patient conversation tutor. Ask one useful question at a time, follow my curiosity, check what I understand and explain without overwhelming me." },
  { id: "experiment", title: "Create & Experiment", icon: "⌁", detail: "Explore through experiments and making.", prompt: "Help me learn by designing a safe, practical experiment or creative project. State materials, steps, what to observe, why it happens and any safety precautions. If a real experiment is unsuitable, use a thought experiment or simulation." },
];

const gradeBands = [
  ["early-years", "Early years"],
  ["primary", "Primary school"],
  ["middle", "Middle school"],
  ["secondary", "Secondary school"],
  ["higher-secondary", "Higher secondary"],
  ["college", "College / university"],
  ["postgraduate", "Postgraduate / research"],
  ["professional", "Professional development"],
  ["adult", "Independent learner"],
  ["not-sure", "Help me choose my level"],
];

function readQuizPayload(content) {
  if (typeof content !== "string") return null;
  const cleaned = content.trim().replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const value = JSON.parse(cleaned);
    if (value?.type !== "aahana_quiz_v1" || !Array.isArray(value.questions) || value.questions.length < 1 || value.questions.length > 5) return null;
    const supportedQuizVisuals = ["fraction", "orbit", "water-cycle", "plant-growth", "number-line", "molecule", "concept-map", "timeline", "bar-chart", "anatomy", "circuit", "code-flow", "sound-wave", "map", "3d-solar-system", "3d-planet", "3d-molecule", "3d-atom", "3d-dna", "3d-geometry", "3d-terrain", "3d-plant-cell", "3d-heart", "3d-pyramid", "3d-ecosystem", "3d-engine"];
    const questions = value.questions.filter((item) =>
      typeof item?.question === "string" && item.question.trim() &&
      Array.isArray(item.options) && item.options.length === 4 &&
      item.options.every((option) => typeof option === "string" && option.trim()) &&
      new Set(item.options).size === 4 &&
      Number.isInteger(item.correctIndex) && item.correctIndex >= 0 && item.correctIndex < 4 &&
      typeof item.explanation === "string" && item.explanation.trim() &&
      typeof item.hint === "string" && item.hint.trim() &&
      supportedQuizVisuals.includes(item.visual)
    );
    if (questions.length !== value.questions.length) return null;
    return { title: typeof value.title === "string" ? value.title : "A little challenge", questions };
  } catch {
    return null;
  }
}

function InteractiveQuiz({ quiz }) {
  const [answers, setAnswers] = useState({});
  const [selectedOptions, setSelectedOptions] = useState({});
  const [attempts, setAttempts] = useState({});
  const completed = quiz.questions.every((_, index) => answers[index] === quiz.questions[index].correctIndex);
  const score = quiz.questions.reduce((total, item, index) => total + (answers[index] === item.correctIndex ? 1 : 0), 0);
  function choose(index, optionIndex) {
    if (Number.isInteger(answers[index])) return;
    setSelectedOptions((current) => ({ ...current, [index]: optionIndex }));
    setAttempts((current) => ({ ...current, [index]: (current[index] || 0) + 1 }));
    if (optionIndex === quiz.questions[index].correctIndex) {
      setAnswers((current) => ({ ...current, [index]: optionIndex }));
    }
  }
  function retry(index) {
    setSelectedOptions((current) => ({ ...current, [index]: null }));
  }
  return (
    <div className="learning-quiz">
      <div className="learning-quiz-heading"><strong>{quiz.title}</strong><span>{completed ? "Challenge complete!" : `${score}/${quiz.questions.length} discovered`}</span></div>
      <div className="learning-quiz-progress" aria-label={`${score} of ${quiz.questions.length} questions solved`}><span style={{ width: `${(score / quiz.questions.length) * 100}%` }} /></div>
      {quiz.questions.map((item, index) => {
        const selected = answers[index];
        const selectedOption = selectedOptions[index];
        const tries = attempts[index] || 0;
        const solved = selected === item.correctIndex;
        const hasAnswered = Number.isInteger(selectedOption);
        return <section className={solved ? "learning-quiz-question solved" : "learning-quiz-question"} key={index}>
          <div className="learning-quiz-question-top"><span>CHALLENGE {index + 1}</span>{solved && <span className="learning-quiz-sparkle">✦ Nice discovery!</span>}</div>
          <div className="learning-quiz-question-layout">
            <div className="learning-quiz-visual-box" aria-live="polite">
              {hasAnswered
                ? <><span className="learning-quiz-visual-label">{solved ? "CORRECT DISCOVERY" : "LET’S VISUALISE IT"}</span><AnimatedVisual visual={item.visual} /><p>{solved ? "Your answer unlocked this visual explanation." : "Look closely at the visual, then try again."}</p></>
                : <div className="learning-quiz-visual-placeholder"><span>✧</span><strong>Your visual appears here</strong><p>Choose an answer to reveal the learning visual.</p></div>}
            </div>
            <div className="learning-quiz-main">
              <h3>{item.question}</h3>
              <div className="learning-quiz-options">
                {item.options.map((option, optionIndex) => <button type="button" key={optionIndex} disabled={solved} aria-pressed={selectedOption === optionIndex} className={selectedOption === optionIndex ? (solved ? "correct" : "incorrect") : solved && optionIndex === item.correctIndex ? "correct" : ""} onClick={() => choose(index, optionIndex)}>
                  <span>{String.fromCharCode(65 + optionIndex)}</span>{option}
                </button>)}
              </div>
              {solved && <div className="learning-quiz-feedback correct"><strong>You figured it out!</strong><p>{item.explanation}</p></div>}
              {!solved && hasAnswered && <div className="learning-quiz-feedback encouraging"><strong>Not quite—and that’s okay. Let’s learn from it.</strong><p>{item.hint}</p><button type="button" onClick={() => retry(index)}>Try another answer</button></div>}
            </div>
          </div>
        </section>;
      })}
      {completed && <div className="learning-quiz-finish"><span className="learning-celebration" aria-hidden="true">✦ ✧ ★ ✧ ✦</span><strong>You did it! You solved all {quiz.questions.length} challenges.</strong><button type="button" onClick={() => { setAnswers({}); setSelectedOptions({}); setAttempts({}); }}>Play again</button></div>}
    </div>
  );
}



const spaceQuizQuestions = [
  { question: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Mercury", "Neptune"], answer: 1, explanation: "Mars looks reddish because iron minerals in its soil have oxidised, much like rust." },
  { question: "Which planet has the largest rings?", options: ["Saturn", "Earth", "Jupiter", "Uranus"], answer: 0, explanation: "Saturn has the Solar System’s most prominent and extensive ring system, made mainly of ice and rocky particles." },
  { question: "Which planet is the largest in our Solar System?", options: ["Neptune", "Earth", "Jupiter", "Saturn"], answer: 2, explanation: "Jupiter is the largest planet by both diameter and mass." },
  { question: "Which planet takes about 365 days to orbit the Sun?", options: ["Mars", "Earth", "Venus", "Mercury"], answer: 1, explanation: "One Earth year is about 365.25 days." },
  { question: "Which planet rotates almost on its side?", options: ["Uranus", "Jupiter", "Mars", "Venus"], answer: 0, explanation: "Uranus has an extreme axial tilt of about 98 degrees." },
];

function SpaceFunQuiz() {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const current = spaceQuizQuestions[questionIndex];
  function choose(index) {
    if (selected !== null || finished) return;
    setSelected(index);
    if (index === current.answer) setScore((value) => value + 1);
  }
  function next() {
    if (questionIndex === spaceQuizQuestions.length - 1) setFinished(true);
    else { setQuestionIndex((value) => value + 1); setSelected(null); }
  }
  function restart() { setQuestionIndex(0); setSelected(null); setScore(0); setFinished(false); }
  return (
    <section className="space-fun-quiz" aria-label="3D space fun quiz game">
      <div className="learning-section-heading"><div><span>SPACE FUN QUIZ</span><h2>Launch your planet challenge</h2></div><span className="space-explorer-tag">5 QUESTIONS · 3D SPACE</span></div>
      <div className="space-fun-quiz-layout">
        <div className="space-fun-quiz-model"><Mini3DModel modelId="solar-system" /><p>Explore the planets in 3D, then test what you discover.</p></div>
        <div className="space-fun-quiz-play">
          {finished ? <>
            <span className="space-quiz-eyebrow">MISSION COMPLETE</span>
            <h3>You scored {score} out of {spaceQuizQuestions.length}!</h3>
            <p>{score === 5 ? "Perfect orbit! You’re a Solar System star." : "Great exploring. Every round makes your space knowledge stronger."}</p>
            <button type="button" onClick={restart}>Play again</button>
          </> : <>
            <div className="space-quiz-meta"><span>QUESTION {questionIndex + 1} / {spaceQuizQuestions.length}</span><span>{score} STARS</span></div>
            <div className="space-quiz-track"><span style={{ width: `${((questionIndex + (selected !== null ? 1 : 0)) / spaceQuizQuestions.length) * 100}%` }} /></div>
            <h3>{current.question}</h3>
            <div className="space-quiz-options">
              {current.options.map((option, index) => <button type="button" key={option} onClick={() => choose(index)} disabled={selected !== null} className={selected === index ? (index === current.answer ? "correct" : "retry") : selected !== null && index === current.answer ? "correct" : ""}>{String.fromCharCode(65 + index)} <span>{option}</span></button>)}
            </div>
            {selected !== null && <div className={selected === current.answer ? "space-quiz-feedback correct" : "space-quiz-feedback"} role="status"><strong>{selected === current.answer ? "Nice shot!" : "Not quite—keep exploring!"}</strong><p>{current.explanation}</p><button type="button" onClick={next}>{questionIndex === spaceQuizQuestions.length - 1 ? "See my score" : "Next question"}</button></div>}
          </>}
        </div>
      </div>
    </section>
  );
}

export default function LearningStudio({ userEmail = "" }) {
  const [selectedPlanet, setSelectedPlanet] = useState("earth");
  const [gradeBand, setGradeBand] = useState("not-sure");
  const [schoolGrade, setSchoolGrade] = useState("");
  const [subject, setSubject] = useState("Anything / explore");
  const [category, setCategory] = useState("Explore anything");
  const categorySubjects = learningCategories.find((item) => item.name === category)?.subjects || learningCategories[0].subjects;
  const [curriculum, setCurriculum] = useState("Not specified");
  const [language, setLanguage] = useState("Use my language");
  const [learningMode, setLearningMode] = useState("talk");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const showSpaceLearning = /\b(?:solar system|space science|astronomy|planets?|planetary|moon|lunar|sun|orbit(?:al)?)\b/i.test([subject, question, ...messages.filter((item) => item.role === "user").map((item) => item.content)].join(" "));

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

  const saveLearningJourney = useCallback(async (journey, profile = { subject, gradeBand, curriculum, language }) => {
    setMemoryError("");
    setMemoryNotice("");
    try {
      const response = await fetch("/api/learning-journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journey: { ...journey, subject: profile.subject, gradeBand: profile.gradeBand, curriculum: profile.curriculum, language: profile.language } }),
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
  }, [loadLearningMemory]);

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
      let resumedProfile = { gradeBand, schoolGrade, subject, curriculum, language, learningMode };
      try {
        const savedProfile = JSON.parse(window.localStorage.getItem("aahana:learning-profile:" + result.conversation.id) || "null");
        if (savedProfile && typeof savedProfile === "object") {
          resumedProfile = {
            gradeBand: gradeBands.some(([value]) => value === savedProfile.gradeBand) ? savedProfile.gradeBand : resumedProfile.gradeBand,
            schoolGrade: ["1","2","3","4","5","6","7","8","9","10"].includes(String(savedProfile.schoolGrade)) ? String(savedProfile.schoolGrade) : resumedProfile.schoolGrade,
            subject: subjects.includes(savedProfile.subject) ? savedProfile.subject : resumedProfile.subject,
            curriculum: curricula.includes(savedProfile.curriculum) ? savedProfile.curriculum : resumedProfile.curriculum,
            language: typeof savedProfile.language === "string" && savedProfile.language.length <= 35 ? savedProfile.language : resumedProfile.language,
            learningMode: learningModes.some((item) => item.id === savedProfile.learningMode) ? savedProfile.learningMode : resumedProfile.learningMode,
          };
          setGradeBand(resumedProfile.gradeBand);
          setSchoolGrade(resumedProfile.schoolGrade);
          if (subjects.includes(resumedProfile.subject)) {
            setSubject(resumedProfile.subject);
            setCategory(learningCategories.find((item) => item.subjects.includes(resumedProfile.subject))?.name || "Explore anything");
          }
          setCurriculum(resumedProfile.curriculum);
          setLanguage(resumedProfile.language);
          setLearningMode(resumedProfile.learningMode);
        }
      } catch {
        // A missing or malformed local profile does not block reopening the conversation.
      }
      setMessages((result.messages || []).map((item) => ({
        role: item.role,
        content: item.content || "",
        learningMode: resumedProfile.learningMode,
        profile: resumedProfile,
      })));
      setQuestion("");
    } catch (err) {
      setError(err.message || "Could not reopen this learning session.");
    } finally {
      setLoadingConversationId(null);
    }
  }

  async function startLearning(event, retryText = "", appendUser = true, retryProfile = null) {
    event?.preventDefault();
    const requestText = (retryText || question).trim();
    if (!requestText || busy) return;
    const profile = retryProfile || { gradeBand, schoolGrade, subject, curriculum, language, learningMode };
    if (!retryText) setQuestion("");
    setError("");
    setBusy(true);
    setMessages((items) => appendUser
      ? [...items, { role: "user", content: requestText, learningMode, profile }, { role: "assistant", content: "", learningMode, profile }]
      : items.map((item, index) => index === items.length - 1 && item.role === "assistant" ? { ...item, content: "", learningMode, profile } : item));
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

      <section className="learning-hero student-welcome">
        <div className="learning-kicker">YOUR LEARNING FRIEND</div>
        <h1>Hi, curious mind!<br /><em>I'm Aahana.</em></h1>
        <p>Tell me what you're learning or what feels confusing. We'll figure it out together, one small step at a time.</p>
      </section>

      <section className="learning-session">
        <div className="learning-section-heading"><div><span>LET’S BEGIN</span><h2>Your learning conversation</h2></div><span className="learning-session-status">{busy ? "Aahana is thinking…" : "Ready when you are"}</span></div>
        {messages.length > 0 && <div className="learning-conversation" aria-live="polite">
          {messages.map((item, index) => {
            const messageMode = item.learningMode || learningMode;
            return <article className={item.role === "user" ? "learning-message learner" : "learning-message tutor"} key={index}>
              <small>{item.role === "user" ? "YOU" : "AAHANA"}</small>
              {item.content ? (messageMode === "play" && item.role === "assistant" && readQuizPayload(item.content)
                ? <InteractiveQuiz quiz={readQuizPayload(item.content)} />
                : item.role === "assistant" && busy && index === messages.length - 1
                  ? <div className="learning-thinking"><i /><i /><i /> {messageMode === "play" ? "Building your quiz" : "Building your interactive lesson"}</div>
                  : item.role === "assistant" && messageMode !== "play"
                    ? <AnimatedLesson
                        content={item.content}
                        topic={messages.slice(0, index).reverse().find((message) => message.role === "user")?.content || ""}
                        memoryEnabled={learningMemory.enabled}
                        onSaveJourney={(journey) => saveLearningJourney(journey, item.profile)}
                        onRetry={() => {
                          const previousQuestion = messages.slice(0, index).reverse().find((message) => message.role === "user")?.content;
                          if (previousQuestion) startLearning(null, previousQuestion, false, item.profile || { gradeBand, subject, curriculum, language, learningMode: messageMode });
                        }}
                      />
                    : <p>{item.content}</p>) : <div className="learning-thinking"><i /><i /><i /> Preparing your lesson</div>}
            </article>;
          })}
        </div>}
        <form className="learning-composer" onSubmit={startLearning}>
          <label htmlFor="learning-question">Search or ask Aahana about any topic</label>
          <textarea id="learning-question" value={question} onChange={(event) => setQuestion(event.target.value)} rows={3} maxLength={8000} disabled={busy} placeholder="Search any topic or ask a question… Why does the Moon change shape? How do birds fly? How does AI work?" />
          <div><span>Aahana will choose the best way to explain it.</span><button type="submit" disabled={!question.trim() || busy}>{busy ? "Learning…" : "Start learning"}</button></div>
        </form>
        {error && <p className="learning-error" role="alert">{error}</p>}
        <p className="learning-note">Explore beyond a fixed subject list: school subjects, advanced ideas, science, technology, history, arts, cultures and everyday questions. Aahana adapts the explanation to your level.</p>
      </section>
      {showSpaceLearning && <>
        <Interactive3DWorld selectedPlanet={selectedPlanet} onSelectedPlanetChange={setSelectedPlanet} />
        <SpaceFunQuiz />
      </>}
      <footer className="learning-footer"><span>Aahana Student Mode</span><span>One question at a time.</span></footer>
    </main>
  );
}
