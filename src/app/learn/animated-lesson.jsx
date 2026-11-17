"use client";

import { useEffect, useMemo, useState } from "react";

const visualTypes = new Set(["fraction", "orbit", "water-cycle", "plant-growth", "number-line", "molecule", "concept-map"]);

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

export function AnimatedVisual({ visual, paused = false }) {
  const cls = paused ? "motion-art paused" : "motion-art";
  if (visual === "fraction") return <svg className={cls} viewBox="0 0 320 170" role="img" aria-label="A circle divided into equal fraction parts"><circle cx="160" cy="82" r="58" fill="#211b2d" stroke="#bda4f3" strokeWidth="3"/><path d="M160 24 A58 58 0 0 1 218 82 L160 82Z" fill="#c7a9f5" className="motion-piece"/><path d="M218 82 A58 58 0 0 1 160 140 L160 82Z" fill="#8e75c2"/><path d="M160 140 A58 58 0 0 1 102 82 L160 82Z" fill="#5f4b83"/><path d="M102 82 A58 58 0 0 1 160 24 L160 82Z" fill="#3e3157"/><path d="M160 24V140M102 82H218" stroke="#eee5ff" strokeWidth="2"/><text x="160" y="160" textAnchor="middle" fill="#e8ddfa" fontSize="11">4 equal parts</text></svg>;
  if (visual === "orbit") return <svg className={cls} viewBox="0 0 320 170" role="img" aria-label="A planet moving around a star"><ellipse cx="160" cy="84" rx="112" ry="48" fill="none" stroke="#9b86c5" strokeDasharray="5 5" strokeWidth="2"/><circle cx="160" cy="84" r="22" fill="#f3c76b" className="motion-sun"/><circle cx="272" cy="84" r="9" fill="#83c8ed" className="motion-orbit"/><circle cx="272" cy="84" r="3" fill="#d8f3ff"/><text x="160" y="130" textAnchor="middle" fill="#e8ddfa" fontSize="11">Gravity keeps the orbit curved</text></svg>;
  if (visual === "water-cycle") return <svg className={cls} viewBox="0 0 320 170" role="img" aria-label="Water moving through the water cycle"><path d="M20 130 Q70 105 120 130T220 130T320 130V170H20Z" fill="#386c9b"/><circle cx="55" cy="35" r="17" fill="#f4cf78"/><path d="M145 105 C120 75 155 58 145 30M185 105 C165 75 200 55 190 25" fill="none" stroke="#a8d9f2" strokeWidth="4" strokeLinecap="round" className="motion-rise"/><path d="M225 52q-12-18-27 0q-16-16-28 1q-20 1-13 19h73q12-17-5-20" fill="#d5c9ed"/><path d="M205 80l-6 12m24-12-6 12m-34-12-6 12" stroke="#8ed1f4" strokeWidth="3" strokeLinecap="round" className="motion-rain"/><text x="160" y="157" textAnchor="middle" fill="#fff" fontSize="10">Evaporation • condensation • rain</text></svg>;
  if (visual === "plant-growth") return <svg className={cls} viewBox="0 0 320 170" role="img" aria-label="A seed growing into a young plant"><path d="M35 125H285" stroke="#a88b69" strokeWidth="5" strokeLinecap="round"/><path d="M160 125V57" stroke="#81c995" strokeWidth="6" strokeLinecap="round" className="motion-grow"/><path d="M160 86Q105 35 92 75Q120 108 160 86" fill="#79c58e"/><path d="M160 72Q205 20 231 59Q211 91 160 72" fill="#9bd7a5"/><path d="M160 125q-20 12-23 27m23-27q18 11 22 27" stroke="#c49b76" strokeWidth="3" fill="none"/><ellipse cx="160" cy="126" rx="11" ry="6" fill="#c69a68"/><text x="160" y="164" textAnchor="middle" fill="#e8ddfa" fontSize="10">Roots anchor • leaves reach for light</text></svg>;
  if (visual === "number-line") return <svg className={cls} viewBox="0 0 320 170" role="img" aria-label="A number line showing equal steps"><path d="M35 85H285m-9-8 9 8-9 8" stroke="#d9c9f5" strokeWidth="3" fill="none"/>{[0,1,2,3,4].map((n)=><g key={n}><path d={`M${45+n*55} 76v18`} stroke="#d9c9f5" strokeWidth="2"/><circle cx={45+n*55} cy="85" r="5" fill="#c7a9f5"/><text x={45+n*55} y="116" fill="#eee5ff" textAnchor="middle" fontSize="12">{n}</text></g>)}<circle cx="155" cy="85" r="11" fill="none" stroke="#f3c76b" strokeWidth="3" className="motion-pulse"/><text x="160" y="145" textAnchor="middle" fill="#e8ddfa" fontSize="10">Equal steps show the distance</text></svg>;
  if (visual === "molecule") return <svg className={cls} viewBox="0 0 320 170" role="img" aria-label="Atoms connected in a molecule"><path d="M112 80L160 45L210 80L160 120Z" stroke="#bba5e6" strokeWidth="7" fill="none"/><circle cx="112" cy="80" r="20" fill="#77bfe2"/><circle cx="160" cy="45" r="18" fill="#d7a4ed"/><circle cx="210" cy="80" r="20" fill="#77bfe2"/><circle cx="160" cy="120" r="18" fill="#d7a4ed"/><text x="112" y="84" fill="#16121f" textAnchor="middle" fontSize="11" fontWeight="700">O</text><text x="160" y="49" fill="#16121f" textAnchor="middle" fontSize="11" fontWeight="700">H</text><text x="210" y="84" fill="#16121f" textAnchor="middle" fontSize="11" fontWeight="700">O</text><text x="160" y="124" fill="#16121f" textAnchor="middle" fontSize="11" fontWeight="700">H</text></svg>;
  return <svg className={cls} viewBox="0 0 320 170" role="img" aria-label="A concept map connecting ideas"><g stroke="#9b86c5" strokeWidth="3"><path d="M160 83L75 40M160 83L245 40M160 83L75 130M160 83L245 130"/></g><circle cx="160" cy="83" r="34" fill="#8068aa"/>{[[75,40],[245,40],[75,130],[245,130]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="20" fill={i%2?"#79b7d7":"#c7a9f5"}/>)}</svg>;
}

export default function AnimatedLesson({ content }) {
  const lesson = useMemo(() => readMotionLesson(content), [content]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sceneAttempts, setSceneAttempts] = useState({});
  const [solvedAttempts, setSolvedAttempts] = useState({});
  const [solved, setSolved] = useState(false);
  const attempts = sceneAttempts[index] || 0;
  const adaptedScenes = Object.keys(solvedAttempts).filter((sceneIndex) => solvedAttempts[sceneIndex] >= 2).length;
  const exploredScenes = Object.keys(solvedAttempts).length;

  useEffect(() => {
    setIndex(0);
    setPaused(false);
    setSceneAttempts({});
    setSolvedAttempts({});
    setSolved(false);
  }, [content]);

  useEffect(() => {
    setSolved(false);
  }, [index]);

  if (!lesson) return <p>{content}</p>;
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

  return <section className="motion-lesson" aria-label="Animated lesson">
    <div className="motion-lesson-head"><div><span>EXPLORE IT IN MOTION</span><h3>{lesson.title}</h3></div><span>SCENE {index + 1} / {lesson.scenes.length}</span></div>
    <div className="motion-stage">
      <AnimatedVisual visual={displayedVisual} paused={paused}/>
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
    </div>}
  </section>;
}
