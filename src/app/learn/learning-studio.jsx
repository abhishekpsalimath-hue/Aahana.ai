"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import "./learning-studio.css";
import AnimatedLesson, { AnimatedVisual, readMotionLesson } from "./animated-lesson";
import Interactive3DWorld from "./interactive-3d-world";
import { learningCategories, allLearningSubjects } from "@/lib/learning/learning-catalog";

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

const subjects = allLearningSubjects;
const curricula = ["Not specified", "CBSE", "ICSE", "Karnataka State Board", "Other Indian State Board", "Cambridge International", "International Baccalaureate (IB)", "England National Curriculum", "US Common Core", "Other / help me choose"];
function LearningCategoryExplorer({ onChooseCategory }) {
  return (
    <section className="learning-category-explorer" aria-label="Explore learning categories">
      <div className="learning-section-heading"><div><span>THE LEARNING UNIVERSE</span><h2>Explore every direction</h2></div><span className="space-explorer-tag">{learningCategories.length} LEARNING WORLDS</span></div>
      <p className="space-explorer-intro">From the first letters and numbers to advanced research, creative practice and everyday skills—choose a world and start anywhere.</p>
      <div className="learning-category-grid">
        {learningCategories.map((item) => (
          <button type="button" className="learning-category-card" key={item.name} onClick={() => onChooseCategory(item.name)}>
            <strong>{item.name}</strong>
            <span>{item.subjects.slice(0, 5).join(" · ")}</span>
            <small>{item.subjects.length} topics <span aria-hidden="true">→</span></small>
          </button>
        ))}
      </div>
    </section>
  );
}

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
      ["fraction", "orbit", "water-cycle", "plant-growth", "number-line", "molecule", "concept-map", "timeline", "bar-chart", "anatomy", "circuit", "code-flow", "sound-wave", "map", "3d-planet", "3d-molecule", "3d-atom", "3d-dna", "3d-geometry", "3d-terrain"].includes(item.visual)
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



const spaceWorlds = [
  { id: "mercury", name: "Mercury", color: "#aaa7a5", orbit: "88 Earth days", fact: "Mercury races around the Sun in just 88 Earth days. Its surface swings between extreme heat and cold because it has almost no atmosphere to hold heat.", wonder: "A year on Mercury is shorter than a season on Earth.", diameter: "4,880 km", sizeFactor: 0.38, challenge: { question: "Which planet completes a trip around the Sun in just 88 Earth days?", options: ["Mercury", "Venus", "Mars"], correct: 0, hint: "It is the closest planet to the Sun." }, },
  { id: "venus", name: "Venus", color: "#e7b77e", orbit: "225 Earth days", fact: "Venus has a thick atmosphere rich in carbon dioxide. Its clouds trap heat so effectively that its surface is hotter than Mercury's.", wonder: "Venus spins in the opposite direction to most planets.", diameter: "12,104 km", sizeFactor: 0.95, challenge: { question: "Why is Venus hotter than Mercury?", options: ["It has a thick heat-trapping atmosphere", "It is closer to the Sun", "It has many active fires"], correct: 0, hint: "Think about the greenhouse effect." }, },
  { id: "earth", name: "Earth", color: "#65b8e8", orbit: "365.25 days", fact: "Earth has liquid water on its surface and an atmosphere that supports life as we know it. Our Moon helps shape ocean tides.", wonder: "So far, Earth is the only world known to host life.", diameter: "12,756 km", sizeFactor: 1, challenge: { question: "What makes Earth special among the worlds we know?", options: ["It has the biggest rings", "It is the only world known to host life", "It has the fastest winds"], correct: 1, hint: "Look for the world with oceans, air and life." }, },
  { id: "mars", name: "Mars", color: "#df805e", orbit: "687 Earth days", fact: "Mars is a cold desert world with a thin atmosphere. Ancient river valleys and minerals suggest liquid water once flowed across parts of its surface.", wonder: "Olympus Mons on Mars is the tallest known volcano in the Solar System.", diameter: "6,792 km", sizeFactor: 0.53, challenge: { question: "What is Olympus Mons?", options: ["A giant volcano", "A frozen ocean", "A moon of Mars"], correct: 0, hint: "It is a huge mountain built by volcanic activity." }, },
  { id: "jupiter", name: "Jupiter", color: "#d5ad83", orbit: "11.86 Earth years", fact: "Jupiter is the largest planet. It is a gas giant with powerful storms, including the Great Red Spot, which has lasted for centuries.", wonder: "Jupiter is so massive that all the other planets could fit inside it by volume.", diameter: "142,984 km", sizeFactor: 11.21, challenge: { question: "What kind of planet is Jupiter?", options: ["Rocky planet", "Gas giant", "Ice giant"], correct: 1, hint: "It is made mostly of hydrogen and helium." }, },
  { id: "saturn", name: "Saturn", color: "#e5d09a", orbit: "29.4 Earth years", fact: "Saturn is a gas giant surrounded by spectacular rings made mostly of countless pieces of ice and rock.", wonder: "Saturn is less dense than water, although there is no ocean large enough to float it.", diameter: "120,536 km", sizeFactor: 9.45, challenge: { question: "What are Saturn's rings made mostly from?", options: ["Liquid water", "Ice and rocky particles", "Clouds of dust only"], correct: 1, hint: "Imagine countless tiny icy pieces orbiting together." }, },
  { id: "uranus", name: "Uranus", color: "#8bd4d2", orbit: "84 Earth years", fact: "Uranus is an ice giant with a blue-green appearance from methane in its atmosphere. It rotates on its side compared with most planets.", wonder: "One Uranian season lasts about 21 Earth years.", diameter: "51,118 km", sizeFactor: 4.01, challenge: { question: "What is unusual about Uranus's rotation?", options: ["It spins on its side", "It does not rotate", "It spins once every day"], correct: 0, hint: "Its axial tilt is close to 98 degrees." }, },
  { id: "neptune", name: "Neptune", color: "#668de7", orbit: "164.8 Earth years", fact: "Neptune is a distant ice giant with supersonic winds and a deep blue atmosphere. It takes almost 165 Earth years to orbit the Sun.", wonder: "Neptune was first identified through mathematical predictions before it was directly observed.", diameter: "49,528 km", sizeFactor: 3.88, challenge: { question: "What is famous about Neptune's weather?", options: ["Supersonic winds", "Daily snowstorms of metal", "No winds at all"], correct: 0, hint: "Its winds can move faster than the speed of sound on Earth." }, },
];

function SpaceExplorer() {
  const [selected, setSelected] = useState("earth");
  const [visited, setVisited] = useState(["earth"]);
  const [solved, setSolved] = useState([]);
  const [attempts, setAttempts] = useState({});
  const [feedback, setFeedback] = useState("");
  const world = spaceWorlds.find((item) => item.id === selected) || spaceWorlds[2];
  const choosePlanet = (id) => {
    setSelected(id);
    setVisited((current) => current.includes(id) ? current : [...current, id]);
    setFeedback("");
  };
  const answerChallenge = (optionIndex) => {
    if (solved.includes(world.id)) return;
    if (optionIndex === world.challenge.correct) {
      setSolved((current) => current.includes(world.id) ? current : [...current, world.id]);
      setFeedback("correct");
    } else {
      setAttempts((current) => ({ ...current, [world.id]: (current[world.id] || 0) + 1 }));
      setFeedback("hint");
    }
  };
  return (
    <section className="space-explorer" aria-label="Interactive Solar System explorer">
      <div className="learning-section-heading"><div><span>INTERACTIVE WORLD EXPLORER</span><h2>Take a trip through our Solar System</h2></div><span className="space-explorer-tag">8 WORLDS TO DISCOVER</span></div>
      <p className="space-explorer-intro">Choose a planet, watch its place in the planetary family, and uncover one surprising fact. The orbit drawing is a learning illustration, not a scale model.</p>
      <div className="space-stage">
        <svg viewBox="0 0 620 300" role="img" aria-label="Illustration of the Sun and eight planets arranged on orbital paths">
          <defs><radialGradient id="spaceSun"><stop offset="0" stopColor="#fff4bd"/><stop offset=".65" stopColor="#ffc45f"/><stop offset="1" stopColor="#ed8747"/></radialGradient></defs>
          {[38,65,91,118,145,172,199,226].map((radius) => <ellipse key={radius} cx="310" cy="150" rx={radius * 1.28} ry={radius * .58} fill="none" stroke="#8d7ba9" strokeOpacity=".28" strokeWidth="1.2" />)}
          <circle cx="310" cy="150" r="20" fill="url(#spaceSun)" className="space-sun-core" />
          <g fill="#f5e8ff"><circle cx="48" cy="46" r="2"/><circle cx="564" cy="62" r="1.7"/><circle cx="520" cy="252" r="2"/><circle cx="88" cy="232" r="1.5"/><circle cx="420" cy="28" r="1.2"/><circle cx="180" cy="274" r="1.4"/></g>
          <g fill="none" stroke="#a99ac1" strokeOpacity=".32" strokeWidth="1.2">
            <ellipse cx="310" cy="150" rx="49" ry="23"/><ellipse cx="310" cy="150" rx="83" ry="38"/><ellipse cx="310" cy="150" rx="116" ry="53"/><ellipse cx="310" cy="150" rx="151" ry="69"/><ellipse cx="310" cy="150" rx="185" ry="85"/><ellipse cx="310" cy="150" rx="220" ry="101"/><ellipse cx="310" cy="150" rx="255" ry="117"/><ellipse cx="310" cy="150" rx="290" ry="133"/>
          </g>
          {[[260,139,"#aaa7a5"],[228,169,"#e7b77e"],[194,111,"#65b8e8"],[159,185,"#df805e"],[125,95,"#d5ad83"],[90,202,"#e5d09a"],[64,72,"#8bd4d2"],[31,225,"#668de7"]].map(([x,y,color],i) => <circle key={i} cx={x} cy={y} r={selected === spaceWorlds[i].id ? 9 : 6} fill={color} stroke={selected === spaceWorlds[i].id ? "#fff" : "#211a2c"} strokeWidth={selected === spaceWorlds[i].id ? 3 : 1.5} className="space-planet-dot" />)}
        </svg>
        <div className="space-stage-caption"><span>THE SUN</span><span>Planetary orbits • not to scale</span></div>
      </div>
      <div className="space-planet-picker" role="group" aria-label="Choose a planet">
        {spaceWorlds.map((planet) => <button type="button" key={planet.id} className={selected === planet.id ? "space-planet-choice active" : "space-planet-choice"} onClick={() => choosePlanet(planet.id)} aria-pressed={selected === planet.id}>
          <i style={{ "--planet-color": planet.color }} aria-hidden="true" /><span>{planet.name}</span>
        </button>)}
      </div>
      <article className="space-discovery" aria-live="polite">
        <div><span>YOUR CURRENT DESTINATION</span><h3>{world.name}</h3><p>{world.fact}</p></div>
        <div className="space-discovery-side"><small>ONE ORBIT AROUND THE SUN</small><strong>{world.orbit}</strong><p>Did you know?</p><em>{world.wonder}</em></div>
      </article>
      <div className="space-mission-progress" aria-live="polite">
        <div><strong>SPACE EXPLORER MISSION</strong><span>{solved.length}/8 discoveries · {solved.length} stars earned</span></div>
        <div className="space-mission-track" role="progressbar" aria-label="Planet discoveries completed" aria-valuemin={0} aria-valuemax={8} aria-valuenow={solved.length}><span style={{ width: `${(solved.length / 8) * 100}%` }} /></div>
        <p>{visited.length} of 8 planets visited. Explore in any order—your mission is to stay curious.</p>
      </div>
      <section className="space-size-lab" aria-label="Planet size comparison">
        <div><span className="space-lab-kicker">PLANET SIZE LAB</span><h3>How big is {world.name}?</h3><p>Compare its equatorial diameter with Earth. The bars use one shared scale.</p></div>
        <div className="space-size-row"><span>Earth</span><div className="space-size-track"><i style={{ width: `${(1 / 11.21) * 100}%` }} /></div><strong>12,756 km · 1×</strong></div>
        <div className="space-size-row"><span>{world.name}</span><div className="space-size-track"><i style={{ width: `${(world.sizeFactor / 11.21) * 100}%` }} /></div><strong>{world.diameter} · {world.sizeFactor}× Earth</strong></div>
      </section>
      <section className="space-mission-challenge" aria-label={`${world.name} discovery challenge`}>
        <div><span className="space-lab-kicker">DISCOVERY CHALLENGE</span><h3>{world.challenge.question}</h3></div>
        <div className="space-challenge-options">
          {world.challenge.options.map((option, index) => <button type="button" key={option} onClick={() => answerChallenge(index)} disabled={solved.includes(world.id)}>{option}</button>)}
        </div>
        {feedback === "correct" || solved.includes(world.id)
          ? <p className="space-challenge-feedback success" role="status">★ Brilliant discovery! You earned a star for {world.name}.</p>
          : feedback === "hint"
            ? <p className="space-challenge-feedback" role="status">Good exploring—try another answer. Hint: {world.challenge.hint}</p>
            : <p className="space-challenge-feedback">Choose an answer. If you need a clue, Aahana will help you try another way.</p>}
      </section>
      <p className="space-explorer-note">Every planet has a different story. You can revisit worlds and try their challenges again anytime.</p>
    </section>
  );
}

export default function LearningStudio({ userEmail = "" }) {
  const [gradeBand, setGradeBand] = useState("not-sure");
  const [subject, setSubject] = useState("Anything / explore");
  const [category, setCategory] = useState("Explore anything");
  const categorySubjects = learningCategories.find((item) => item.name === category)?.subjects || learningCategories[0].subjects;
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

  const learningRoadmap = learningMemory.journeys.reduce((roadmap, item) => {
    const journey = item.journey;
    const revisit = (journey.scenes || [])
      .filter((scene) => scene.alternateExplanationUsed)
      .map((scene) => ({
        title: scene.caption,
        subject: journey.subject,
        gradeBand: journey.gradeBand,
        curriculum: journey.curriculum,
        language: journey.language,
        lessonTitle: journey.title,
      }));
    return {
      revisit: [...roadmap.revisit, ...revisit],
      latest: roadmap.latest || {
        title: journey.title,
        subject: journey.subject,
        gradeBand: journey.gradeBand,
        curriculum: journey.curriculum,
        language: journey.language,
      },
    };
  }, { revisit: [], latest: null });
  const uniqueRevisitTopics = learningRoadmap.revisit.filter((topic, index, all) =>
    all.findIndex((item) => item.title.toLowerCase() === topic.title.toLowerCase() && item.subject === topic.subject) === index
  ).slice(0, 4);

  function exploreRoadmapTopic(topic, revisit = false) {
    setSubject(topic.subject);
    setGradeBand(topic.gradeBand);
    setCurriculum(topic.curriculum);
    setLanguage(topic.language);
    setQuestion(revisit
      ? `Let's explore "${topic.title}" again with a fresh animated explanation and a different example.`
      : `Let's continue exploring "${topic.title}" and connect it to a new idea.`);
    setLearningMode("story");
  }

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
          if (subjects.includes(savedProfile.subject)) {
            setSubject(savedProfile.subject);
            setCategory(learningCategories.find((item) => item.subjects.includes(savedProfile.subject))?.name || "Explore anything");
          }
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

  async function startLearning(event, retryText = "", appendUser = true) {
    event?.preventDefault();
    const requestText = (retryText || question).trim();
    if (!requestText || busy) return;
    const profile = { gradeBand, subject, curriculum, language, learningMode };
    if (!retryText) setQuestion("");
    setError("");
    setBusy(true);
    setMessages((items) => appendUser
      ? [...items, { role: "user", content: requestText }, { role: "assistant", content: "" }]
      : items.map((item, index) => index === items.length - 1 && item.role === "assistant" ? { ...item, content: "" } : item));
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
        <aside className="aahana-teacher-companion" aria-label="Your Aahana AI learning companion">
          <div className="teacher-companion-copy"><span>MEET YOUR LEARNING COMPANION</span><strong>Hey, curious mind!</strong><p>I’m here to make big ideas feel exciting. Ask, explore, experiment — let’s learn together.</p><small>YOUR FRIENDLY GUIDE · AAHANA AI</small></div>
          <div className="teacher-character"><img src="/aahana-founder.webp" alt="Aahana AI's friendly cartoon learning companion" /><span className="teacher-cap">✦</span><span className="teacher-coat" /><span className="teacher-pointer" /></div>
        </aside>
      </section>

      <LearningCategoryExplorer onChooseCategory={(name) => {
        const selectedCategory = learningCategories.find((item) => item.name === name);
        setCategory(name);
        setSubject(selectedCategory?.subjects?.[0] || "Anything / explore");
        document.querySelector(".learning-profile")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }} />

      <SpaceExplorer />
      <Interactive3DWorld />

      <section className="learning-profile" aria-label="Personalise your learning">
        <div className="learning-section-heading"><div><span>YOUR LEARNING SPACE</span><h2>Let’s make this yours</h2></div><button type="button" onClick={resetSession} disabled={busy}>New session</button></div>
        <div className="learning-select-grid">
          <label>Learning level
            <select value={gradeBand} onChange={(event) => setGradeBand(event.target.value)} disabled={busy}>
              {gradeBands.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
          <label>Learning category
            <select value={category} onChange={(event) => {
              const nextCategory = learningCategories.find((item) => item.name === event.target.value);
              setCategory(event.target.value);
              if (nextCategory?.subjects?.length) setSubject(nextCategory.subjects[0]);
            }} disabled={busy}>
              {learningCategories.map((item) => <option value={item.name} key={item.name}>{item.name}</option>)}
            </select>
          </label>
          <label>Choose a subject or topic
            <select value={categorySubjects.includes(subject) ? subject : categorySubjects[0]} onChange={(event) => setSubject(event.target.value)} disabled={busy}>
              {categorySubjects.map((value) => <option key={value}>{value}</option>)}
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
      {learningMemory.enabled && learningMemory.journeys.length > 0 && <section className="learning-roadmap" aria-label="Your next learning steps">
        <div className="learning-section-heading"><div><span>BUILT FROM YOUR SAVED JOURNEYS</span><h2>Your next discoveries</h2></div></div>
        <p>These are gentle suggestions based only on lessons you chose to save. They are invitations—not grades or assumptions about what you know.</p>
        {uniqueRevisitTopics.length > 0 && <div className="learning-roadmap-group">
          <h3>Explore with a fresh explanation</h3>
          {uniqueRevisitTopics.map((topic) => <article className="learning-roadmap-item" key={topic.subject + topic.title}>
            <div><strong>{topic.title}</strong><small>{topic.subject} · from {topic.lessonTitle}</small></div>
            <button type="button" onClick={() => exploreRoadmapTopic(topic, true)}>Explore again</button>
          </article>)}
        </div>}
        {learningRoadmap.latest && <div className="learning-roadmap-group">
          <h3>Continue your curiosity</h3>
          <article className="learning-roadmap-item">
            <div><strong>{learningRoadmap.latest.title}</strong><small>{learningRoadmap.latest.subject} · build a new connection</small></div>
            <button type="button" onClick={() => exploreRoadmapTopic(learningRoadmap.latest)}>Continue</button>
          </article>
        </div>}
      </section>}
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
              : item.role === "assistant" && busy && index === messages.length - 1
                ? <div className="learning-thinking"><i /><i /><i /> {learningMode === "play" ? "Building your quiz" : "Building your interactive lesson"}</div>
                : item.role === "assistant" && learningMode !== "play"
                  ? <AnimatedLesson
                      content={item.content}
                      topic={messages.slice(0, index).reverse().find((message) => message.role === "user")?.content || ""}
                      memoryEnabled={learningMemory.enabled}
                      onSaveJourney={saveLearningJourney}
                      onRetry={() => {
                        const previousQuestion = messages.slice(0, index).reverse().find((message) => message.role === "user")?.content;
                        if (previousQuestion) startLearning(null, previousQuestion, false);
                      }}
                    />
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
