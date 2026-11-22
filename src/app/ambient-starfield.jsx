"use client";

import { useEffect, useRef } from "react";

const STAR_COUNT = 1000;

function createStars(width, height) {
  let seed = 20261120;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  return Array.from({ length: STAR_COUNT }, () => ({
    x: random() * width,
    y: random() * height,
    radius: 0.35 + random() * 1.05,
    phase: random() * Math.PI * 2,
    speed: 0.25 + random() * 0.8,
    opacity: 0.22 + random() * 0.58,
    tint: random(),
  }));
}

export default function AmbientStarfield() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !context) return undefined;

    let width = 0;
    let height = 0;
    let stars = [];
    let frame = 0;
    let animationFrame = 0;
    let visible = true;
    let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    function resize() {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      stars = createStars(width, height);
      draw(0);
    }

    function draw(time) {
      context.clearRect(0, 0, width, height);
      const seconds = time / 1000;
      for (let index = 0; index < stars.length; index += 1) {
        const star = stars[index];
        const twinkle = reducedMotion ? 1 : 0.68 + 0.32 * Math.sin(seconds * star.speed + star.phase);
        const alpha = star.opacity * twinkle;
        context.beginPath();
        context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        context.fillStyle = star.tint > 0.86
          ? `rgba(218, 203, 255, ${alpha})`
          : star.tint > 0.58
            ? `rgba(190, 181, 255, ${alpha})`
            : `rgba(239, 235, 255, ${alpha})`;
        context.fill();
        if (star.radius > 1.12 && alpha > 0.55) {
          context.beginPath();
          context.arc(star.x, star.y, star.radius * 3.2, 0, Math.PI * 2);
          context.fillStyle = `rgba(185, 157, 255, ${alpha * 0.075})`;
          context.fill();
        }
      }
    }

    function animate(time) {
      if (!visible || reducedMotion) return;
      if (time - frame >= 40) {
        draw(time);
        frame = time;
      }
      animationFrame = window.requestAnimationFrame(animate);
    }

    function start() {
      window.cancelAnimationFrame(animationFrame);
      if (visible && !reducedMotion) animationFrame = window.requestAnimationFrame(animate);
      else draw(0);
    }

    function onMotionChange(event) {
      reducedMotion = event.matches;
      start();
    }

    function onVisibilityChange() {
      visible = document.visibilityState === "visible";
      start();
    }

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);
    if (!observer) window.addEventListener("resize", resize);
    motionQuery.addEventListener?.("change", onMotionChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    resize();
    start();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer?.disconnect();
      if (!observer) window.removeEventListener("resize", resize);
      motionQuery.removeEventListener?.("change", onMotionChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return <canvas ref={canvasRef} className="ambient-starfield" aria-hidden="true" data-star-count={STAR_COUNT} />;
}
