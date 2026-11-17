"use client";

import { useEffect, useMemo, useState } from "react";
import { Mini3DModel } from "./interactive-3d-world";

const visualTypes = new Set(["counter-board", "shape-explorer", "fraction", "orbit", "water-cycle", "plant-growth", "number-line", "molecule", "concept-map", "timeline", "bar-chart", "anatomy", "circuit", "code-flow", "sound-wave", "map", "3d-solar-system", "3d-planet", "3d-molecule", "3d-atom", "3d-dna", "3d-geometry", "3d-terrain", "3d-plant-cell", "3d-heart", "3d-pyramid", "3d-ecosystem", "3d-engine"]);

function validVisualData(data) {
  return typeof data?.label === "string" && data.label.trim() && data.label.length <= 90 &&
    typeof data.value === "string" && data.value.trim() && data.value.length <= 36 &&
    typeof data.unit === "string" && data.unit.length <= 24 &&
    typeof data.comparison === "string" && data.comparison.length <= 120 &&
    Number.isInteger(data.progress) && data.progress >= 0 && data.progress <= 100;
}

export function readMotionLesson(content) {
  if (typeof content !== "string") return null;
  const cleaned = content.trim().replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const value = JSON.parse(cleaned);
    if (value?.type !== "aahana_motion_lesson_v1" || typeof value.title !== "string" ||
        !Array.isArray(value.scenes) || value.scenes.length < 2 || value.scenes.length > 6) return null;
    const scenes = value.scenes.filter((scene) =>
      typeof scene?.caption === "string" && scene.caption.trim() && scene.caption.length <= 120 &&
      typeof scene?.narration === "string" && scene.narration.trim() && scene.narration.length <= 1200 &&
      visualTypes.has(scene.visual) &&
      validVisualData(scene.visualData) &&
      visualTypes.has(scene?.support?.visual) && scene.support.visual !== scene.visual &&
      validVisualData(scene.support.visualData) &&
      typeof scene.support.explanation === "string" && scene.support.explanation.trim() && scene.support.explanation.length <= 500 &&
      typeof scene?.action === "string" && scene.action.trim() && scene.action.length <= 260 &&
      typeof scene?.challenge?.question === "string" && scene.challenge.question.trim() && scene.challenge.question.length <= 240 &&
      Array.isArray(scene.challenge.options) && scene.challenge.options.length === 3 &&
      scene.challenge.options.every((option) => typeof option === "string" && option.trim() && option.length <= 120) &&
      new Set(scene.challenge.options).size === 3 &&
      Number.isInteger(scene.challenge.correctIndex) && scene.challenge.correctIndex >= 0 && scene.challenge.correctIndex < 3 &&
      Array.isArray(scene.challenge.hints) && scene.challenge.hints.length === 2 &&
      scene.challenge.hints.every((hint) => typeof hint === "string" && hint.trim() && hint.length <= 260) &&
      typeof scene.challenge.hint === "string" && scene.challenge.hint.trim() && scene.challenge.hint.length <= 260 &&
      typeof scene.challenge.explanation === "string" && scene.challenge.explanation.trim() && scene.challenge.explanation.length <= 500
    );
    if (scenes.length !== value.scenes.length) return null;
    return { title: value.title.slice(0, 100), scenes };
  } catch {
    return null;
  }
}

const solarSystemFallbackLesson = {
  title: "Journey Through Our Solar System",
  scenes: [
    {
      caption: "Meet our planetary family",
      narration: "Our Solar System is made of the Sun and everything held by its gravity, including eight planets. The planets travel around the Sun along their own paths. Explore the model and notice how many different worlds belong to this family.",
      visual: "3d-solar-system",
      visualData: { label: "Planetary family", value: "8 planets", unit: "", comparison: "Mercury → Neptune", progress: 25 },
      support: { visual: "orbit", visualData: { label: "Planetary family", value: "8 planets", unit: "", comparison: "Each planet follows an orbit around the Sun", progress: 25 }, explanation: "The Sun is at the centre of our planetary system. Eight planets travel around it." },
      action: "Rotate the 3D model and trace a path from the closest planet outward.",
      challenge: { question: "How many planets are in our Solar System?", options: ["Seven", "Eight", "Nine"], correctIndex: 1, hints: ["Count the recognised planets from Mercury to Neptune.", "There are four inner planets and four outer planets."], hint: "There are four inner planets and four outer planets.", explanation: "There are eight recognised planets orbiting the Sun." },
    },
    {
      caption: "The four rocky inner worlds",
      narration: "The four planets closest to the Sun are Mercury, Venus, Earth and Mars. They are called terrestrial planets because they have solid, rocky surfaces. Their order from the Sun begins with Mercury and ends with Mars.",
      visual: "3d-solar-system",
      visualData: { label: "Inner planets", value: "4 rocky worlds", unit: "", comparison: "Mercury • Venus • Earth • Mars", progress: 50 },
      support: { visual: "concept-map", visualData: { label: "Inner planets", value: "4 rocky worlds", unit: "", comparison: "They are the first four planets from the Sun", progress: 50 }, explanation: "The inner group contains Mercury, Venus, Earth and Mars. All four have solid surfaces." },
      action: "Find Earth, then move inward to identify the planet closest to the Sun.",
      challenge: { question: "Which planet is closest to the Sun?", options: ["Venus", "Earth", "Mercury"], correctIndex: 2, hints: ["It is the first planet when travelling outward from the Sun.", "Its name begins with M."], hint: "Its name begins with M.", explanation: "Mercury is the innermost planet and completes an orbit in about 88 Earth days." },
    },
    {
      caption: "The four giant outer planets",
      narration: "Beyond the inner rocky worlds are Jupiter, Saturn, Uranus and Neptune. Jupiter and Saturn are gas giants, while Uranus and Neptune are ice giants. Saturn is famous for its bright, extensive ring system.",
      visual: "3d-solar-system",
      visualData: { label: "Outer planets", value: "4 giant worlds", unit: "", comparison: "Jupiter • Saturn • Uranus • Neptune", progress: 75 },
      support: { visual: "concept-map", visualData: { label: "Outer planets", value: "4 giant worlds", unit: "", comparison: "They follow Mars in the planet order", progress: 75 }, explanation: "The outer group starts with Jupiter and continues through Saturn, Uranus and Neptune." },
      action: "Rotate the model and compare the outer group with the four rocky inner planets.",
      challenge: { question: "Which planet is especially famous for its broad, bright rings?", options: ["Mars", "Saturn", "Mercury"], correctIndex: 1, hints: ["It is the second planet in the outer group.", "Its name starts with S."], hint: "Its name starts with S.", explanation: "Saturn's spectacular ring system is made mostly of countless pieces of ice and rock." },
    },
    {
      caption: "Why do planets keep moving around the Sun?",
      narration: "A planet's forward motion and the Sun's gravitational pull work together to create an orbit. An orbit is a curved path through space, not a solid track. Earth takes about 365.25 days to complete one revolution around the Sun; that journey defines an Earth year.",
      visual: "3d-planet",
      visualData: { label: "Earth's revolution", value: "365.25 days", unit: "per orbit", comparison: "One trip around the Sun is one Earth year", progress: 100 },
      support: { visual: "orbit", visualData: { label: "Earth's revolution", value: "1 year", unit: "", comparison: "Earth travels around the Sun once", progress: 100 }, explanation: "Earth moves forward while the Sun's gravity continually changes the direction of its motion. Together these create an orbit." },
      action: "Rotate the planet model and imagine its path curving around the Sun.",
      challenge: { question: "What keeps planets in curved paths around the Sun?", options: ["The Sun's gravity", "A solid invisible road", "Light from distant stars"], correctIndex: 0, hints: ["Think of the force that attracts objects with mass.", "It is the same force that makes objects fall toward Earth."], hint: "It is the same force that makes objects fall toward Earth.", explanation: "Gravity attracts the planets toward the Sun while their forward motion carries them along their orbits." },
    },
  ],
};

const shapeFacts = {
  circle: { name: "Circle", sides: 0, corners: 0, note: "A circle has one curved boundary and no corners." },
  triangle: { name: "Triangle", sides: 3, corners: 3, note: "A triangle has three straight sides and three corners." },
  square: { name: "Square", sides: 4, corners: 4, note: "A square has four equal straight sides and four corners." },
  rectangle: { name: "Rectangle", sides: 4, corners: 4, note: "A rectangle has four straight sides. Opposite sides are equal." },
};

function InteractiveShapeExplorer({ paused = false }) {
  const [selected, setSelected] = useState("triangle");
  const fact = shapeFacts[selected];
  return <section className={paused ? "motion-art paused shape-explorer" : "motion-art shape-explorer"} aria-label="Interactive 2D shape explorer">
    <div className="shape-explorer-heading"><strong>Explore a shape</strong><span>Choose one to investigate</span></div>
    <div className="shape-explorer-stage" role="img" aria-label={fact.name + " shape illustration"}>
      <svg viewBox="0 0 220 150" aria-hidden="true">
        {selected === "circle" && <circle cx="110" cy="75" r="54" />}
        {selected === "triangle" && <path d="M110 18 174 128H46Z" />}
        {selected === "square" && <rect x="54" y="19" width="112" height="112" rx="2" />}
        {selected === "rectangle" && <rect x="32" y="38" width="156" height="74" rx="2" />}
      </svg>
    </div>
    <div className="shape-explorer-choices" aria-label="Choose a shape">
      {Object.keys(shapeFacts).map((key) => <button type="button" key={key} aria-pressed={selected === key} onClick={() => setSelected(key)}>{shapeFacts[key].name}</button>)}
    </div>
    <div className="shape-explorer-facts" aria-live="polite">
      <strong>{fact.name}</strong><span>{fact.sides} straight sides · {fact.corners} corners</span><p>{fact.note}</p>
    </div>
  </section>;
}

function InteractiveCounterBoard({ paused = false }) {
  const [count, setCount] = useState(5);
  const [target, setTarget] = useState(8);
  const reached = count === target;
  return <section className={paused ? "motion-art paused counter-board" : "motion-art counter-board"} aria-label="Interactive counting board">
    <div className="counter-board-heading"><strong>Build a group</strong><span>{count} of {target}</span></div>
    <div className="counter-board-track" role="img" aria-label={count + " counters shown"}>
      {Array.from({ length: count }, (_, index) => <span className="counter-board-piece" key={index} aria-hidden="true">{index + 1}</span>)}
      {count === 0 && <span className="counter-board-zero">No counters yet — this is zero</span>}
    </div>
    <div className="counter-board-controls">
      <button type="button" onClick={() => setCount((value) => Math.max(0, value - 1))} disabled={count === 0} aria-label="Remove one counter">− One</button>
      <button type="button" onClick={() => setCount((value) => Math.min(20, value + 1))} disabled={count === 20} aria-label="Add one counter">+ One</button>
      <button type="button" onClick={() => { setCount(5); setTarget(8); }}>Reset</button>
    </div>
    <div className="counter-board-challenge">
      <span>Try a new target</span>
      {[3, 6, 10, 12].map((value) => <button type="button" key={value} aria-pressed={target === value} onClick={() => setTarget(value)}>{value}</button>)}
    </div>
    <p className="counter-board-feedback" aria-live="polite">{reached ? "You made the target group. Great counting!" : count < target ? "Add " + (target - count) + " more to reach " + target + "." : "Take away " + (count - target) + " to reach " + target + "."}</p>
  </section>;
}

export function AnimatedVisual({ visual, paused = false }) {
  if (visual === "counter-board") return <InteractiveCounterBoard paused={paused} />;
  if (visual === "shape-explorer") return <InteractiveShapeExplorer paused={paused} />;
  const cls = paused ? "motion-art paused" : "motion-art";
  const model3d = { "3d-solar-system": "solar-system", "3d-planet": "planet", "3d-molecule": "molecule", "3d-atom": "atom", "3d-dna": "dna", "3d-geometry": "cube", "3d-terrain": "terrain", "3d-plant-cell": "plant-cell", "3d-heart": "heart", "3d-pyramid": "pyramid", "3d-ecosystem": "ecosystem", "3d-engine": "engine" }[visual];
  if (model3d) return <Mini3DModel modelId={model3d} />;
  if (visual === "fraction") return <svg className={cls} viewBox="0 0 320 170" role="img" aria-label="A circle divided into equal fraction parts"><circle cx="160" cy="82" r="58" fill="#211b2d" stroke="#bda4f3" strokeWidth="3"/><path d="M160 24 A58 58 0 0 1 218 82 L160 82Z" fill="#c7a9f5" className="motion-piece"/><path d="M218 82 A58 58 0 0 1 160 140 L160 82Z" fill="#8e75c2"/><path d="M160 140 A58 58 0 0 1 102 82 L160 82Z" fill="#5f4b83"/><path d="M102 82 A58 58 0 0 1 160 24 L160 82Z" fill="#3e3157"/><path d="M160 24V140M102 82H218" stroke="#eee5ff" strokeWidth="2"/><text x="160" y="160" textAnchor="middle" fill="#e8ddfa" fontSize="11">4 equal parts</text></svg>;
  if (visual === "orbit") return <svg className={cls} viewBox="0 0 320 170" role="img" aria-label="A planet moving around a star"><ellipse cx="160" cy="84" rx="112" ry="48" fill="none" stroke="#9b86c5" strokeDasharray="5 5" strokeWidth="2"/><circle cx="160" cy="84" r="22" fill="#f3c76b" className="motion-sun"/><circle cx="272" cy="84" r="9" fill="#83c8ed" className="motion-orbit"/><circle cx="272" cy="84" r="3" fill="#d8f3ff"/><text x="160" y="130" textAnchor="middle" fill="#e8ddfa" fontSize="11">Gravity keeps the orbit curved</text></svg>;
  if (visual === "water-cycle") return <svg className={cls} viewBox="0 0 320 170" role="img" aria-label="Water moving through the water cycle"><path d="M20 130 Q70 105 120 130T220 130T320 130V170H20Z" fill="#386c9b"/><circle cx="55" cy="35" r="17" fill="#f4cf78"/><path d="M145 105 C120 75 155 58 145 30M185 105 C165 75 200 55 190 25" fill="none" stroke="#a8d9f2" strokeWidth="4" strokeLinecap="round" className="motion-rise"/><path d="M225 52q-12-18-27 0q-16-16-28 1q-20 1-13 19h73q12-17-5-20" fill="#d5c9ed"/><path d="M205 80l-6 12m24-12-6 12m-34-12-6 12" stroke="#8ed1f4" strokeWidth="3" strokeLinecap="round" className="motion-rain"/><text x="160" y="157" textAnchor="middle" fill="#fff" fontSize="10">Evaporation • condensation • rain</text></svg>;
  if (visual === "plant-growth") return <svg className={cls} viewBox="0 0 320 170" role="img" aria-label="A seed growing into a young plant"><path d="M35 125H285" stroke="#a88b69" strokeWidth="5" strokeLinecap="round"/><path d="M160 125V57" stroke="#81c995" strokeWidth="6" strokeLinecap="round" className="motion-grow"/><path d="M160 86Q105 35 92 75Q120 108 160 86" fill="#79c58e"/><path d="M160 72Q205 20 231 59Q211 91 160 72" fill="#9bd7a5"/><path d="M160 125q-20 12-23 27m23-27q18 11 22 27" stroke="#c49b76" strokeWidth="3" fill="none"/><ellipse cx="160" cy="126" rx="11" ry="6" fill="#c69a68"/><text x="160" y="164" textAnchor="middle" fill="#e8ddfa" fontSize="10">Roots anchor • leaves reach for light</text></svg>;
  if (visual === "number-line") return <svg className={cls} viewBox="0 0 320 170" role="img" aria-label="A number line showing equal steps"><path d="M35 85H285m-9-8 9 8-9 8" stroke="#d9c9f5" strokeWidth="3" fill="none"/>{[0,1,2,3,4].map((n)=><g key={n}><path d={`M${45+n*55} 76v18`} stroke="#d9c9f5" strokeWidth="2"/><circle cx={45+n*55} cy="85" r="5" fill="#c7a9f5"/><text x={45+n*55} y="116" fill="#eee5ff" textAnchor="middle" fontSize="12">{n}</text></g>)}<circle cx="155" cy="85" r="11" fill="none" stroke="#f3c76b" strokeWidth="3" className="motion-pulse"/><text x="160" y="145" textAnchor="middle" fill="#e8ddfa" fontSize="10">Equal steps show the distance</text></svg>;
  if (visual === "molecule") return <svg className={cls} viewBox="0 0 320 170" role="img" aria-label="Atoms connected in a molecule"><path d="M112 80L160 45L210 80L160 120Z" stroke="#bba5e6" strokeWidth="7" fill="none"/><circle cx="112" cy="80" r="20" fill="#77bfe2"/><circle cx="160" cy="45" r="18" fill="#d7a4ed"/><circle cx="210" cy="80" r="20" fill="#77bfe2"/><circle cx="160" cy="120" r="18" fill="#d7a4ed"/><text x="112" y="84" fill="#16121f" textAnchor="middle" fontSize="11" fontWeight="700">O</text><text x="160" y="49" fill="#16121f" textAnchor="middle" fontSize="11" fontWeight="700">H</text><text x="210" y="84" fill="#16121f" textAnchor="middle" fontSize="11" fontWeight="700">O</text><text x="160" y="124" fill="#16121f" textAnchor="middle" fontSize="11" fontWeight="700">H</text></svg>;
  if (visual === "timeline") return <svg className={cls} viewBox="0 0 320 170" role="img" aria-label="A timeline showing events in sequence"><path d="M28 85H292" stroke="#bda4f3" strokeWidth="4" strokeLinecap="round"/>{[48,104,160,216,272].map((x,i)=><g key={x}><circle cx={x} cy="85" r="9" fill={i%2?"#79b7d7":"#c7a9f5"} className="motion-pulse"/><path d={`M${x} 74V${i%2?42:128}`} stroke="#9b86c5" strokeWidth="2"/><rect x={x-22} y={i%2?16:132} width="44" height="18" rx="7" fill="#51416e"/><text x={x} y={i%2?29:145} fill="#fff" textAnchor="middle" fontSize="9">{i+1}</text></g>)}<text x="160" y="164" fill="#e8ddfa" textAnchor="middle" fontSize="10">Events in chronological order</text></svg>;
  if (visual === "bar-chart") return <svg className={cls} viewBox="0 0 320 170" role="img" aria-label="A simple bar chart comparing quantities"><path d="M38 18V140H292" fill="none" stroke="#d9c9f5" strokeWidth="2"/>{[48,94,140,186].map((x,i)=><g key={x}><rect x={x} y={132-[42,78,58,100][i]} width="27" height={[42,78,58,100][i]} rx="5" fill={i%2?"#79b7d7":"#b99be9"} className="motion-grow"/><text x={x+13} y="154" fill="#eee5ff" textAnchor="middle" fontSize="10">{String.fromCharCode(65+i)}</text></g>)}<text x="160" y="14" fill="#e8ddfa" textAnchor="middle" fontSize="10">Compare values</text></svg>;
  if (visual === "anatomy") return <svg className={cls} viewBox="0 0 320 170" role="img" aria-label="Simplified educational human body diagram"><circle cx="160" cy="27" r="16" fill="#d7a4ed"/><path d="M160 44V111M160 57L110 91M160 57L210 91M160 111L126 157M160 111L194 157" stroke="#9bc9e8" strokeWidth="13" strokeLinecap="round" fill="none"/><path d="M160 56q-25 0-22 24q22 15 44 0q3-24-22-24" fill="#d97992" stroke="#ffd4e0" strokeWidth="2"/><path d="M160 66v31" stroke="#f2c66d" strokeWidth="4" strokeLinecap="round"/><text x="160" y="169" fill="#e8ddfa" textAnchor="middle" fontSize="10">Simplified body-system illustration</text></svg>;
  if (visual === "circuit") return <svg className={cls} viewBox="0 0 320 170" role="img" aria-label="A simple closed electrical circuit"><path d="M65 48H128M192 48H255V126H65V48" fill="none" stroke="#9b86c5" strokeWidth="5" strokeLinecap="round"/><rect x="128" y="30" width="64" height="36" rx="7" fill="#51416e" stroke="#d9c9f5" strokeWidth="2"/><path d="M145 40V56M157 35V61M177 40V56" stroke="#f3c76b" strokeWidth="3"/><circle cx="255" cy="87" r="17" fill="#f3c76b" className="motion-pulse"/><path d="M65 48l-9-8m9 8-9 8" stroke="#fff" strokeWidth="2"/><text x="160" y="151" fill="#e8ddfa" textAnchor="middle" fontSize="10">A closed path lets current flow</text></svg>;
  if (visual === "code-flow") return <svg className={cls} viewBox="0 0 320 170" role="img" aria-label="A flowchart showing steps in a program"><g stroke="#a994d2" strokeWidth="2" fill="none"><path d="M160 42V58M160 94V111M120 76H74V128H120M200 76H246V128H200"/></g><rect x="113" y="12" width="94" height="30" rx="8" fill="#6f5a94"/><path d="M160 59 205 76 160 94 115 76Z" fill="#b18fe2"/><rect x="25" y="112" width="98" height="30" rx="8" fill="#477f9c"/><rect x="197" y="112" width="98" height="30" rx="8" fill="#477f9c"/><g fill="#fff" fontSize="10" textAnchor="middle"><text x="160" y="31">START</text><text x="160" y="79">DECISION?</text><text x="74" y="131">YES</text><text x="246" y="131">NO</text></g></svg>;
  if (visual === "sound-wave") return <svg className={cls} viewBox="0 0 320 170" role="img" aria-label="A sound wave with repeating peaks and troughs"><path d="M20 85H300" stroke="#9b86c5" strokeWidth="1.5" strokeDasharray="4 5"/><path d="M20 85 Q42 18 64 85T108 85T152 85T196 85T240 85T284 85" fill="none" stroke="#83c8ed" strokeWidth="5" strokeLinecap="round" className="motion-wave"/><text x="160" y="145" fill="#e8ddfa" textAnchor="middle" fontSize="11">Vibration travels as a wave</text></svg>;
  if (visual === "map") return <svg className={cls} viewBox="0 0 320 170" role="img" aria-label="A simplified map with a route between locations"><path d="M30 30 95 18 148 42 220 20 292 40 278 140 214 154 154 130 88 151 30 120Z" fill="#294b58" stroke="#79b7d7" strokeWidth="2"/><path d="M58 115Q95 35 150 75T258 52" fill="none" stroke="#f3c76b" strokeWidth="4" strokeDasharray="7 5" className="motion-wave"/><circle cx="58" cy="115" r="7" fill="#f3c76b"/><circle cx="258" cy="52" r="7" fill="#f3c76b"/><text x="58" y="136" fill="#fff" textAnchor="middle" fontSize="9">START</text><text x="258" y="35" fill="#fff" textAnchor="middle" fontSize="9">GOAL</text></svg>;
  return <svg className={cls} viewBox="0 0 320 170" role="img" aria-label="A concept map connecting ideas"><g stroke="#9b86c5" strokeWidth="3"><path d="M160 83L75 40M160 83L245 40M160 83L75 130M160 83L245 130"/></g><circle cx="160" cy="83" r="34" fill="#8068aa"/>{[[75,40],[245,40],[75,130],[245,130]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="20" fill={i%2?"#79b7d7":"#c7a9f5"}/>)}</svg>;
}

export default function AnimatedLesson({ content, topic = "", memoryEnabled = false, onSaveJourney, onRetry }) {
  const isSolarSystemTopic = /\b(?:solar system|planets?|sun|mercury|venus|earth|mars|jupiter|saturn|uranus|neptune|planetary orbit)\b/i.test(topic);
  const lesson = useMemo(() => readMotionLesson(content) || (isSolarSystemTopic ? solarSystemFallbackLesson : null), [content, isSolarSystemTopic]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sceneAttempts, setSceneAttempts] = useState({});
  const [solvedAttempts, setSolvedAttempts] = useState({});
  const [solved, setSolved] = useState(false);
  const [journeySaving, setJourneySaving] = useState(false);
  const [journeySaved, setJourneySaved] = useState(false);
  const [journeySaveError, setJourneySaveError] = useState("");
  const attempts = sceneAttempts[index] || 0;
  const adaptedScenes = Object.keys(solvedAttempts).filter((sceneIndex) => solvedAttempts[sceneIndex] >= 2).length;
  const exploredScenes = Object.keys(solvedAttempts).length;

  useEffect(() => {
    setIndex(0);
    setPaused(false);
    setSceneAttempts({});
    setSolvedAttempts({});
    setSolved(false);
    setJourneySaved(false);
    setJourneySaveError("");
  }, [content]);

  useEffect(() => {
    setSolved(false);
  }, [index]);

  if (!lesson) return <div className="motion-lesson-unavailable" role="alert">
    <strong>Your interactive lesson needs another moment.</strong>
    <p>Aahana couldn't prepare the lesson in its interactive format this time. Your question is safe to try again—no script will be shown in place of the lesson.</p>
    {onRetry && <button type="button" onClick={onRetry}>Try the interactive lesson again</button>}
  </div>;
  const scene = lesson.scenes[index];
  const challenge = scene.challenge;
  const showSupport = attempts >= 2 && !solved;
  const displayedVisual = showSupport ? scene.support.visual : scene.visual;
  const displayedData = showSupport ? scene.support.visualData : scene.visualData;

  function answer(optionIndex) {
    if (solved) return;
    if (optionIndex === challenge.correctIndex) {
      setSolved(true);
      setSolvedAttempts((current) => ({ ...current, [index]: (sceneAttempts[index] || 0) + 1 }));
    } else {
      setSceneAttempts((current) => ({ ...current, [index]: (current[index] || 0) + 1 }));
    }
  }

  function restartLesson() {
    setIndex(0);
    setSceneAttempts({});
    setSolvedAttempts({});
    setSolved(false);
    setPaused(false);
  }

  async function saveJourney() {
    if (!memoryEnabled || !onSaveJourney || journeySaving || journeySaved) return;
    setJourneySaving(true);
    setJourneySaveError("");
    try {
      const attemptsUsed = Object.values(solvedAttempts).reduce((total, count) => total + count, 0);
      const saved = await onSaveJourney({
        title: lesson.title,
        sceneCount: lesson.scenes.length,
        attempts: attemptsUsed,
        adaptedScenes,
        exploredScenes,
        scenes: lesson.scenes.map((item, sceneIndex) => ({
          caption: item.caption,
          alternateExplanationUsed: (solvedAttempts[sceneIndex] || 0) >= 2,
        })),
      });
      if (saved) setJourneySaved(true);
      else setJourneySaveError("This journey could not be saved just now. Please try again.");
    } catch {
      setJourneySaveError("We couldn't save your journey just now. Your lesson progress is still here—please try again.");
    } finally {
      setJourneySaving(false);
    }
  }

  return <section className="motion-lesson" aria-label="Animated lesson">
    <div className="motion-lesson-head"><div><span>EXPLORE IT IN MOTION</span><h3>{lesson.title}</h3></div><span>SCENE {index + 1} / {lesson.scenes.length}</span></div>
    <div className="motion-progress" role="group" aria-label="Lesson progress">
      <div className="motion-progress-label"><span>YOUR EXPLORATION</span><strong>{exploredScenes} of {lesson.scenes.length} scenes completed</strong></div>
      <div className="motion-progress-track" role="progressbar" aria-label="Completed lesson scenes" aria-valuemin={0} aria-valuemax={lesson.scenes.length} aria-valuenow={exploredScenes}>
        <span style={{ width: `${(exploredScenes / lesson.scenes.length) * 100}%` }} />
      </div>
      <div className="motion-progress-steps" aria-hidden="true">
        {lesson.scenes.map((item, sceneIndex) => <span key={sceneIndex} className={solvedAttempts[sceneIndex] ? "completed" : sceneIndex === index ? "current" : ""} />)}
      </div>
    </div>
    <div className={solved ? "motion-stage is-celebrating" : "motion-stage"}>
      <div className="motion-stardust" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div>
      <AnimatedVisual visual={displayedVisual} paused={paused}/>
      <div className={`motion-companion ${solved ? "is-happy" : ""}`} aria-label="Aahana learning companion">
        <svg viewBox="0 0 88 88" role="img" aria-label="A friendly little star companion">
          <defs><linearGradient id="buddyGlow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffe7a6"/><stop offset="1" stopColor="#c6a7f5"/></linearGradient></defs>
          <path d="M44 5 54 29 80 31 60 49 66 75 44 62 22 75 28 49 8 31 34 29Z" fill="url(#buddyGlow)" stroke="#fff0c8" strokeWidth="2.5" strokeLinejoin="round"/>
          <ellipse cx="35" cy="40" rx="4" ry="6" fill="#332744"/><ellipse cx="53" cy="40" rx="4" ry="6" fill="#332744"/>
          <path d="M38 51q6 7 12 0" fill="none" stroke="#704d70" strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx="26" cy="49" r="4" fill="#f39ab2" opacity=".8"/><circle cx="62" cy="49" r="4" fill="#f39ab2" opacity=".8"/>
          <path d="m17 13-4-5m58 5 4-5" stroke="#fff0c8" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <span aria-live="polite">{solved ? "You did it! ✨" : showSupport ? "We can try a new way!" : "Let's discover together!"}</span>
      </div>
      <div className="motion-caption">{showSupport ? "Let's look at it another way" : scene.caption}</div>
      <div className="motion-data" aria-label={`${displayedData.label}: ${displayedData.value} ${displayedData.unit}`}>
        <div className="motion-data-copy"><span>{displayedData.label}</span><strong>{displayedData.value}{displayedData.unit ? ` ${displayedData.unit}` : ""}</strong></div>
        <div className="motion-data-track" role="img" aria-label={`Illustrated level ${displayedData.progress} percent`}><span style={{ width: `${displayedData.progress}%` }}/></div>
        {displayedData.comparison && <p>{displayedData.comparison}</p>}
      </div>
      {showSupport && <p className="motion-support-explanation">{scene.support.explanation}</p>}
    </div>
    <p className="motion-narration">{scene.narration}</p>
    <div className="motion-action"><strong>Explore:</strong> {scene.action}</div>
    <div className="motion-prediction" aria-live="polite">
      <strong>{challenge.question}</strong>
      <div className="motion-prediction-options">
        {challenge.options.map((option, optionIndex) => <button type="button" key={optionIndex} disabled={solved} aria-pressed={false} onClick={() => answer(optionIndex)}>
          <span>{String.fromCharCode(65 + optionIndex)}</span>{option}
        </button>)}
      </div>
      {solved
        ? <p className="motion-feedback success"><strong>Great discovery!</strong> {challenge.explanation}</p>
        : attempts > 0
          ? <p className="motion-feedback gentle"><strong>{showSupport ? "A different way to see it:" : "Good thinking—let's explore again."}</strong> {showSupport ? challenge.hints[1] : challenge.hints[0]}</p>
          : <p className="motion-feedback gentle">Take your time. Every prediction helps you understand.</p>}
    </div>
    <div className="motion-controls">
      <button type="button" onClick={() => setIndex((n) => Math.max(0,n-1))} disabled={index===0}>Previous scene</button>
      <button type="button" onClick={() => setPaused((v)=>!v)}>{paused ? "Play motion" : "Pause motion"}</button>
      <button type="button" disabled={!solved} onClick={() => setIndex((n) => (n+1)%lesson.scenes.length)}>{index===lesson.scenes.length-1 ? "Replay lesson" : "Next scene"}</button>
    </div>
    {!solved && <p className="motion-unlock-note">Solve this little discovery to unlock the next scene. You can try as many times as you like.</p>}
    {solved && index === lesson.scenes.length - 1 && <div className="motion-learning-reflection" aria-live="polite">
      <strong>Adventure complete! You explored every scene.</strong>
      <p>{adaptedScenes > 0
        ? `You discovered ${adaptedScenes} idea${adaptedScenes === 1 ? "" : "s"} through an alternate explanation. Trying a new way is a powerful learning skill.`
        : "You worked through every idea in this lesson. Curiosity and careful thinking helped you get here."}</p>
      <span>{exploredScenes} of {lesson.scenes.length} scenes explored · {adaptedScenes} alternate explanation{adaptedScenes === 1 ? "" : "s"} used</span>
      <button type="button" onClick={restartLesson}>Explore again</button>
      {journeySaveError && <p className="motion-save-error" role="alert">{journeySaveError}</p>}
      {memoryEnabled
        ? <button type="button" onClick={saveJourney} disabled={journeySaving || journeySaved}>{journeySaved ? "Saved to your journey" : journeySaving ? "Saving…" : "Save to my journey"}</button>
        : <p>Turn on private learning memory above if you would like to save this journey.</p>}
    </div>}
  </section>;
}
