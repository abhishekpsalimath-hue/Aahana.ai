"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./universe-lab.module.css";

const worlds = [
  { id: "galaxies", name: "Galaxies", note: "Vast island universes, each holding billions of stars.", color: "#c7a7ff" },
  { id: "stars", name: "Stars", note: "Stellar nurseries, brilliant suns and the light between them.", color: "#ffe2ad" },
  { id: "planets", name: "Planets", note: "Worlds with their own colour, atmosphere and character.", color: "#8db9ff" },
  { id: "moons", name: "Moons", note: "Natural satellites orbiting planets, from icy worlds to cratered landscapes.", color: "#d9d4ff" },
  { id: "solar-systems", name: "Solar systems", note: "Stars and the families of planets, moons, rings and smaller bodies around them.", color: "#ffc98c" },
  { id: "black-holes", name: "Black holes", note: "Regions where gravity bends space-time so intensely that not even light escapes beyond the event horizon.", color: "#d6b5ff" },
  { id: "nebulae", name: "Nebulae", note: "Cosmic clouds of gas and dust, including stellar nurseries where new stars form.", color: "#ff9fd7" },
  { id: "asteroids-comets", name: "Asteroids & comets", note: "Rocky and icy travellers moving through planetary space.", color: "#9fe9e4" },
  { id: "space-time", name: "Space & time", note: "The four-dimensional fabric in which every cosmic event takes place.", color: "#a8c4ff" },
  { id: "matter-energy", name: "Matter & energy", note: "The physical ingredients and processes that make the cosmos dynamic.", color: "#ffdb9e" },
  { id: "dark-matter", name: "Dark matter", note: "Invisible matter inferred from its gravitational influence on galaxies and cosmic structure.", color: "#9b8bff" },
  { id: "dark-energy", name: "Dark energy", note: "The name for the unknown cause of the universe's accelerated expansion.", color: "#88c9ff" },
];

function Starfield({ pointerRef, animate }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !context) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let width = 0;
    let height = 0;
    let stars = [];
    let dpr = 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(850, Math.max(180, Math.round(width * height / 2200)));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width, y: Math.random() * height,
        radius: Math.random() * 1.25 + 0.2, alpha: Math.random() * 0.62 + 0.16,
        phase: Math.random() * Math.PI * 2, speed: Math.random() * 0.006 + 0.0015,
      }));
    };
    const draw = (time = 0) => {
      context.clearRect(0, 0, width, height);
      for (const star of stars) {
        const pulse = reduced ? 1 : 0.68 + Math.sin(time * star.speed + star.phase) * 0.26;
        const px = star.x + (pointerRef.current.x - 0.5) * star.radius * 2.8;
        const py = star.y + (pointerRef.current.y - 0.5) * star.radius * 2.8;
        context.beginPath();
        context.fillStyle = `rgba(231,220,255,${star.alpha * pulse})`;
        context.arc(px, py, star.radius, 0, Math.PI * 2);
        context.fill();
      }
      if (!reduced && animate) frame = requestAnimationFrame(draw);
    };
    resize();
    draw();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [animate, pointerRef]);
  return <canvas ref={canvasRef} className={styles.starfield} aria-hidden="true" />;
}

export default function UniverseLab() {
  const [selected, setSelected] = useState("galaxies");
  const pointerRef = useRef({ x: 0.5, y: 0.5 });
  const [motion, setMotion] = useState(true);
  const active = worlds.find((world) => world.id === selected) || worlds[0];

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setMotion(false);
  }, []);

  return (
    <main className={styles.universe} data-motion={motion ? "true" : "false"} onPointerMove={(event) => {
      if (event.pointerType !== "mouse") return;
      const rect = event.currentTarget.getBoundingClientRect();
      pointerRef.current = { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
    }}>
      <Starfield pointerRef={pointerRef} animate={motion} />
      <div className={styles.nebula} aria-hidden="true" />
      <header className={styles.header}>
        <a className={styles.brand} href="/">Aahana <span>AI</span></a>
        <div className={styles.headerRight}><span className={styles.liveDot} /> UNIVERSE EXPERIMENT</div>
      </header>

      <section className={styles.hero}>
        <p className={styles.kicker}>A SPACE TO EXPLORE</p>
        <h1>Your intelligence.<br /><em>Your universe.</em></h1>
        <p className={styles.intro}>A living space for ideas, discovery and creation. Move through the cosmos and choose a world to explore.</p>
      </section>

      <section className={styles.orbitStage} aria-label="Interactive universe">
        <div className={styles.halo} aria-hidden="true" />
        <div className={styles.galaxy} aria-hidden="true"><i /><i /><i /></div>
        <div className={styles.planet planetOne} aria-hidden="true" />
        <div className={styles.planet planetTwo} aria-hidden="true" />
        <div className={styles.solarOrbit} aria-hidden="true"><i /></div>
        <div className={styles.cometTrail} aria-hidden="true" />
        <div className={styles.blackHole} aria-hidden="true"><i /></div>
        <button className={`${styles.world} ${styles.worldGalaxy} ${selected === "galaxies" ? styles.chosen : ""}`} onClick={() => setSelected("galaxies")} aria-pressed={selected === "galaxies"}>Galaxies</button>
        <button className={`${styles.world} ${styles.worldStar} ${selected === "stars" ? styles.chosen : ""}`} onClick={() => setSelected("stars")} aria-pressed={selected === "stars"}>Stars</button>
        <button className={`${styles.world} ${styles.worldPlanet} ${selected === "planets" ? styles.chosen : ""}`} onClick={() => setSelected("planets")} aria-pressed={selected === "planets"}>Planets</button>
        <button className={`${styles.world} ${styles.worldHole} ${selected === "black-holes" ? styles.chosen : ""}`} onClick={() => setSelected("black-holes")} aria-pressed={selected === "black-holes"}>Black holes</button>
        <button className={`${styles.world} ${styles.worldNebula} ${selected === "nebulae" ? styles.chosen : ""}`} onClick={() => setSelected("nebulae")} aria-pressed={selected === "nebulae"}>Nebulae</button>
        <button className={`${styles.world} ${styles.worldComet} ${selected === "comets" ? styles.chosen : ""}`} onClick={() => setSelected("comets")} aria-pressed={selected === "comets"}>Comets</button>
        <button className={`${styles.world} ${styles.worldEnergy} ${selected === "cosmic-energy" ? styles.chosen : ""}`} onClick={() => setSelected("cosmic-energy")} aria-pressed={selected === "cosmic-energy"}>Cosmic energy</button>
      </section>

      <section className={styles.detail} aria-live="polite">
        <div><span className={styles.detailEyebrow}>NOW EXPLORING</span><h2>{active.name}</h2><p>{active.note}</p></div>
        <div className={styles.detailMark} style={{ "--world-color": active.color }} aria-hidden="true" />
      </section>

      <nav className={styles.worldList} aria-label="Choose a cosmic element">
        {worlds.map((world) => <button key={world.id} onClick={() => setSelected(world.id)} className={selected === world.id ? styles.activeWorld : ""} aria-pressed={selected === world.id}>{world.name}</button>)}
      </nav>

      <footer className={styles.footer}>
        <span>SPACE IS NOT A BACKGROUND. IT IS THE EXPERIENCE.</span>
        <button onClick={() => setMotion((value) => !value)} aria-pressed={!motion}>{motion ? "Pause motion" : "Resume motion"}</button>
      </footer>
    </main>
  );
}
