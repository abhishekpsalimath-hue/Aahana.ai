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
    let timer = null;

    const stop = () => {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };
    const start = () => {
      if (timer !== null || document.hidden || motion?.matches) return;
      timer = window.setInterval(() => {
        setMoment((current) => (
          current + 1 + Math.floor(Math.random() * (moments.length - 1))
        ) % moments.length);
      }, 7600);
    };
    const handleVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    const handleMotionPreference = () => {
      if (motion?.matches) stop();
      else start();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    motion?.addEventListener?.("change", handleMotionPreference);
    start();

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
      motion?.removeEventListener?.("change", handleMotionPreference);
    };
  }, []);

  const current = moments[moment];
  return (
    <aside className={`astronaut-companion astronaut-companion--${variant} astronaut-action--${current.action}`} aria-label="Aahana astronaut companion">
      <div className="astronaut-companion__message" aria-live="off">{current[variant] || current.assistant}</div>
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
