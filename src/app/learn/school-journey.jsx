"use client";

import { useEffect, useMemo, useState } from "react";
import { GRADE_1_MATH, SCHOOL_JOURNEY, getGradeOneMathProgress, getNextSchoolSubject } from "@/lib/learning/school-journey.mjs";

const STORAGE_KEY = "aahana.school-journey.v1";

function readProgress() {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export default function SchoolJourney() {
  const [progress, setProgress] = useState({});
  const [ready, setReady] = useState(false);
  const [answers, setAnswers] = useState({});
  const [feedback, setFeedback] = useState({});

  useEffect(() => {
    setProgress(readProgress());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress, ready]);

  const mathProgress = useMemo(() => getGradeOneMathProgress(progress), [progress]);
  const current = getNextSchoolSubject(progress);
  const mathKey = "grade-1:mathematics";

  function checkAnswer(unit) {
    const selected = answers[unit.id];
    if (!Number.isInteger(selected)) return;
    if (selected === unit.answer) {
      setProgress((previous) => {
        const units = {
          ...(previous[mathKey]?.units || {}),
          [unit.id]: { complete: true, completedAt: new Date().toISOString() }
        };
        const subjectComplete = GRADE_1_MATH.units.every((item) => units[item.id]?.complete);
        return {
          ...previous,
          [mathKey]: { ...(previous[mathKey] || {}), units, complete: subjectComplete }
        };
      });
      setFeedback((previous) => ({ ...previous, [unit.id]: { correct: true, message: unit.explanation } }));
    } else {
      setFeedback((previous) => ({ ...previous, [unit.id]: { correct: false, message: "Not quite. Read the example again, then try another answer." } }));
    }
  }

  const gradeOne = SCHOOL_JOURNEY.grades[0];
  const gradeTwo = SCHOOL_JOURNEY.grades[1];

  return (
    <section className="school-journey" aria-label="Grade-by-grade school achievement journey">
      <div className="learning-section-heading">
        <div><span>ONE FOCUS · ONE ACHIEVEMENT</span><h2>School learning journey</h2></div>
        <span className="space-explorer-tag">GRADE BY GRADE</span>
      </div>
      <p className="space-explorer-intro">We finish one subject before moving to the next. Complete the lesson and its knowledge check to unlock the next step. Progress stays on this device.</p>

      <div className="school-journey-overview">
        <div className="school-grade-card active">
          <span className="school-grade-kicker">CURRENT GRADE</span>
          <strong>{gradeOne.label}</strong>
          <span>{mathProgress.completedUnits} of {mathProgress.totalUnits} Mathematics units complete</span>
          <div className="catalogue-coverage-track" role="progressbar" aria-label="Grade 1 Mathematics progress" aria-valuemin={0} aria-valuemax={mathProgress.totalUnits} aria-valuenow={mathProgress.completedUnits}>
            <span style={{ width: (mathProgress.completedUnits / mathProgress.totalUnits * 100) + "%" }} />
          </div>
        </div>
        <div className="school-grade-card locked">
          <span className="school-grade-kicker">NEXT GRADE</span>
          <strong>{gradeTwo.label}</strong>
          <span>Unlock after every Grade 1 subject is complete</span>
          <span className="school-lock-label">Locked for now</span>
        </div>
      </div>

      <div className="school-subject-list" aria-label="Grade 1 subject sequence">
        <h3>Grade 1 · Subject sequence</h3>
        {gradeOne.subjects.map((subject, index) => {
          const key = "grade-1:" + subject.id;
          const done = Boolean(progress[key]?.complete);
          const active = !done && current?.key === key;
          return (
            <div className={done ? "school-subject-row done" : active ? "school-subject-row current" : "school-subject-row locked"} key={subject.id}>
              <span className="school-subject-number">{done ? "✓" : String(index + 1).padStart(2, "0")}</span>
              <span className="school-subject-name">{subject.title}</span>
              <span className="school-subject-status">{done ? "Achievement unlocked" : active ? "Current focus" : "Locked"}</span>
            </div>
          );
        })}
      </div>

      {mathProgress.complete ? (
        <div className="school-achievement" role="status">
          <span>✦ ACHIEVEMENT UNLOCKED</span>
          <h3>Grade 1 Mathematics completed!</h3>
          <p>The next subject in the Grade 1 sequence is now unlocked. Its lesson content will be added as the next focused build.</p>
        </div>
      ) : (
        <div className="school-subject-work">
          <div className="school-work-heading">
            <div><span>ACTIVE SUBJECT · GRADE 1</span><h3>{GRADE_1_MATH.title}</h3></div>
            <span>{mathProgress.completedUnits}/{mathProgress.totalUnits} units</span>
          </div>
          <p>{GRADE_1_MATH.description}</p>
          <div className="school-unit-list">
            {GRADE_1_MATH.units.map((unit, index) => {
              const complete = Boolean(progress[mathKey]?.units?.[unit.id]?.complete);
              const previousComplete = index === 0 || Boolean(progress[mathKey]?.units?.[GRADE_1_MATH.units[index - 1].id]?.complete);
              const open = !complete && previousComplete;
              const result = feedback[unit.id];
              return (
                <article className={complete ? "school-unit complete" : open ? "school-unit open" : "school-unit locked"} key={unit.id}>
                  <div className="school-unit-top">
                    <span>UNIT {index + 1}</span>
                    <strong>{complete ? "Completed ✓" : open ? "Ready to learn" : "Complete the previous unit first"}</strong>
                  </div>
                  <h4>{unit.title}</h4>
                  <p className="school-unit-objective">{unit.objective}</p>
                  {open && (
                    <>
                      <ol className="school-teaching-steps">{unit.teach.map((line, i) => <li key={i}>{line}</li>)}</ol>
                      <div className="school-example"><strong>Let's try one</strong><p>{unit.example}</p></div>
                      <p className="school-practice"><strong>Try it yourself:</strong> {unit.practice}</p>
                      <div className="school-check">
                        <strong>{unit.question}</strong>
                        <div className="school-answer-options">
                          {unit.options.map((option, optionIndex) => (
                            <button type="button" key={option} className={answers[unit.id] === optionIndex ? "selected" : ""} onClick={() => { setAnswers((old) => ({ ...old, [unit.id]: optionIndex })); setFeedback((old) => ({ ...old, [unit.id]: null })); }}>
                              {option}
                            </button>
                          ))}
                        </div>
                        <button type="button" className="school-check-button" disabled={!Number.isInteger(answers[unit.id])} onClick={() => checkAnswer(unit)}>Check my answer</button>
                        {result && <p className={result.correct ? "school-feedback correct" : "school-feedback"} role="status">{result.message}</p>}
                      </div>
                    </>
                  )}
                  {complete && <p className="school-complete-note">Knowledge check passed. Your next unit is ready.</p>}
                </article>
              );
            })}
          </div>
        </div>
      )}
      <p className="school-journey-note">This is the first grade-one subject tranche. The subject order is a starter sequence and can be aligned to the learner's school board and language choices before those subjects are authored.</p>
    </section>
  );
}
