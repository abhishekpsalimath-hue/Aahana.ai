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
  const [position, setPosition] = useState(null);

  useEffect(() => {
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia?.("(max-width: 760px)").matches === true;
    const size = mobile ? 72 : 112;
    let timer = null;

    const randomPosition = () => {
      const maxLeft = Math.max(12, window.innerWidth - size - 14);
      const minTop = mobile ? 72 : 84;
      const bottomReserve = mobile ? 112 : 142;
      const maxTop = Math.max(minTop, window.innerHeight - size - bottomReserve);
      return {
        left: Math.round(12 + Math.random() * Math.max(0, maxLeft - 12)),
        top: Math.round(minTop + Math.random() * Math.max(0, maxTop - minTop)),
      };
    };

    const move = () => {
      setPosition(randomPosition());
      setMoment((current) => (
        current + 1 + Math.floor(Math.random() * (moments.length - 1))
      ) % moments.length);
    };
    const stop = () => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
    };
    const start = () => {
      if (timer !== null || document.hidden || motion?.matches) return;
      timer = window.setInterval(move, 9800);
    };
    const handleVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    const handleMotionPreference = () => {
      if (motion?.matches) stop();
      else start();
    };
    const handleResize = () => setPosition(randomPosition());

    setPosition(randomPosition());
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("resize", handleResize, { passive: true });
    motion?.addEventListener?.("change", handleMotionPreference);
    start();

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("resize", handleResize);
      motion?.removeEventListener?.("change", handleMotionPreference);
    };
  }, []);

  const current = moments[moment];
  return (
    <aside className={`astronaut-companion astronaut-companion--${variant} astronaut-action--${current.action}`} aria-label="Aahana astronaut companion" style={position ? { left: `${position.left}px`, top: `${position.top}px`, visibility: "visible" } : { visibility: "hidden" }}>
      <div className="astronaut-companion__message" aria-live="off">{current[variant] || current.assistant}</div>
      <img
        className="astronaut-companion__image"
        src="/astronaut.webp"
        alt="Aahana's astronaut companion"
        width="857"
        height="1536"
        draggable="false"
        fetchPriority="high"
      />
    </aside>
  );
}
