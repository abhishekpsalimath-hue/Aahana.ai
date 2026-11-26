"use client";

import { useEffect, useState } from "react";

const moments = [
  { login: "Ready for takeoff?", assistant: "Need a hand? I'm right here.", action: "drift" },
  { login: "Welcome aboard!", assistant: "Let's turn that idea into something real.", action: "bank" },
  { login: "Your space is waiting.", assistant: "Thinking… plotting our next move.", action: "rise" },
  { login: "Let's make something brilliant.", assistant: "Nice work. Keep the momentum going!", action: "glide" },
];

export default function AstronautCompanion({ variant = "assistant" }) {
  const [moment, setMoment] = useState(0);

  useEffect(() => {
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (motion?.matches) return undefined;
    let previous = 0;
    const timer = window.setInterval(() => {
      setMoment((current) => {
        let next = Math.floor(Math.random() * moments.length);
        if (moments.length > 1) {
          while (next === current || next === previous) next = Math.floor(Math.random() * moments.length);
        }
        previous = current;
        return next;
      });
    }, 7600);
    return () => window.clearInterval(timer);
  }, []);

  const current = moments[moment];
  return (
    <aside className={`astronaut-companion astronaut-companion--${variant} astronaut-action--${current.action}`} aria-label="Aahana astronaut companion">
      <div className="astronaut-companion__message" aria-live="polite">{current[variant] || current.assistant}</div>
      <img
        className="astronaut-companion__image"
        src="/astronaut.webp"
        alt="Aahana's astronaut companion"
        width="857"
        height="1536"
        draggable="false"
        fetchPriority="low"
      />
    </aside>
  );
}
