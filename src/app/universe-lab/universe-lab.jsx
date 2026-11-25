"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./universe-lab.module.css";

const worlds = [
  { id: "galaxies", name: "Galaxies", note: "Vast island universes, each holding billions of stars.", fact: "The Milky Way is a barred spiral galaxy, one among an enormous cosmic population.", guide: "Trace the spiral arms outward and notice how gravity gathers stars into vast structures.", color: "#c7a7ff" },
  { id: "stars", name: "Stars", note: "Stellar nurseries, brilliant suns and the light between them.", fact: "Stars shine because nuclear fusion in their cores releases energy as light and heat.", guide: "Compare a star's colour and brightness; these clues help astronomers estimate its temperature and life stage.", color: "#ffe2ad" },
  { id: "planets", name: "Planets", note: "Worlds with their own colour, atmosphere and character.", fact: "Planets form in disks of gas and dust around young stars.", guide: "Look for differences in atmosphere, surface and orbit to understand why worlds evolve differently.", color: "#8db9ff" },
  { id: "moons", name: "Moons", note: "Natural satellites orbiting planets, from icy worlds to cratered landscapes.", fact: "Some moons may hide vast oceans beneath icy crusts.", guide: "Consider what tides, ice and internal heating might reveal about hidden environments beneath a moon's surface.", color: "#d9d4ff" },
  { id: "solar-systems", name: "Solar systems", note: "Stars and the families of planets, moons, rings and smaller bodies around them.", fact: "Our solar system formed about 4.6 billion years ago from a rotating cloud of gas and dust.", guide: "Follow each orbit around its star; the distance and orbital period help define a system's architecture.", color: "#ffc98c" },
  { id: "black-holes", name: "Black holes", note: "Regions where gravity bends space-time so intensely that not even light escapes beyond the event horizon.", fact: "The event horizon is the boundary beyond which escape is impossible—not a solid surface.", guide: "Focus on the glowing ring: light can bend around a black hole even though light cannot escape from inside its event horizon.", color: "#d6b5ff" },
  { id: "nebulae", name: "Nebulae", note: "Cosmic clouds of gas and dust, including stellar nurseries where new stars form.", fact: "Nebulae can be stellar nurseries or the expanding remains of stars.", guide: "Look for dense clouds and glowing regions where gravity can help gas collapse into new stars.", color: "#ff9fd7" },
  { id: "asteroids-comets", name: "Asteroids & comets", note: "Rocky and icy travellers moving through planetary space.", fact: "A comet's tail points generally away from the Sun as sunlight warms its icy nucleus.", guide: "Compare rocky asteroids with icy comets; their different materials create very different journeys near the Sun.", color: "#9fe9e4" },
  { id: "space-time", name: "Space & time", note: "The four-dimensional fabric in which every cosmic event takes place.", fact: "In general relativity, mass and energy shape space-time, and that geometry guides motion.", guide: "Imagine a grid bending around mass: in relativity, objects follow paths through curved space-time.", color: "#a8c4ff" },
  { id: "matter-energy", name: "Matter & energy", note: "The physical ingredients and processes that make the cosmos dynamic.", fact: "Mass and energy are linked by E = mc².", guide: "Think of energy as something that can change form; mass and energy are linked, not separate ingredients.", color: "#ffdb9e" },
  { id: "dark-matter", name: "Dark matter", note: "Invisible matter inferred from its gravitational influence on galaxies and cosmic structure.", fact: "We infer dark matter through gravity, including galaxy rotation and gravitational lensing.", guide: "Notice the lensing pattern: invisible mass can reveal itself by bending light from more distant objects.", color: "#9b8bff" },
  { id: "dark-energy", name: "Dark energy", note: "The name for the unknown cause of the universe's accelerated expansion.", fact: "Dark energy names the unknown cause of the observed acceleration of cosmic expansion.", guide: "Imagine distant galaxies separating faster over cosmic time; the cause of that accelerated expansion remains unknown.", color: "#88c9ff" },
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
    let inView = true;
    let pageVisible = !document.hidden;

    const shouldAnimate = () => animate && !reduced && inView && pageVisible;
    const draw = (time = 0) => {
      context.clearRect(0, 0, width, height);
      for (const star of stars) {
        const pulse = shouldAnimate()
          ? 0.68 + Math.sin(time * star.speed + star.phase) * 0.26
          : 1;
        const px = star.x + (pointerRef.current.x - 0.5) * star.radius * 2.8;
        const py = star.y + (pointerRef.current.y - 0.5) * star.radius * 2.8;
        context.beginPath();
        context.fillStyle = `rgba(231,220,255,${star.alpha * pulse})`;
        context.arc(px, py, star.radius, 0, Math.PI * 2);
        context.fill();
      }
      if (shouldAnimate()) frame = requestAnimationFrame(draw);
      else frame = 0;
    };

    const scheduleDraw = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      draw();
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const area = width * height;
      const count = Math.min(560, Math.max(120, Math.round(area / 3200)));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.15 + 0.2,
        alpha: Math.random() * 0.62 + 0.16,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.006 + 0.0015,
      }));
      scheduleDraw();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      scheduleDraw();
    }, { threshold: 0 });
    visibilityObserver.observe(canvas);
    const onVisibilityChange = () => {
      pageVisible = !document.hidden;
      scheduleDraw();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    resize();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      visibilityObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [animate, pointerRef]);

  return <canvas ref={canvasRef} className={styles.starfield} aria-hidden="true" />;
}
export default function UniverseLab() {
  const [selected, setSelected] = useState("galaxies");
  const pointerRef = useRef({ x: 0.5, y: 0.5 });
  const [motion, setMotion] = useState(true);
  const [journeyStarted, setJourneyStarted] = useState(false);
  const active = worlds.find((world) => world.id === selected) || worlds[0];
  const choose = (id) => { setSelected(id); setJourneyStarted(true); };
  const moveJourney = (direction) => {
    const index = worlds.findIndex((world) => world.id === selected);
    choose(worlds[(index + direction + worlds.length) % worlds.length].id);
  };
  const sceneTarget = (id, className, label, children) => (
    <button type="button" className={`${className} ${selected === id ? styles.sceneChosen : ""}`}
      onClick={() => choose(id)} aria-label={`Explore ${label}`} aria-pressed={selected === id}>
      {children}
    </button>
  );

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setMotion(false);
  }, []);

  return (
    <main className={styles.universe} data-motion={motion ? "true" : "false"} onPointerMove={(event) => {
      if (event.pointerType !== "mouse") return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = (event.clientX - rect.left) / Math.max(rect.width, 1);
      const y = (event.clientY - rect.top) / Math.max(rect.height, 1);
      pointerRef.current = { x, y };
      event.currentTarget.style.setProperty("--parallax-x", `${(0.5 - x) * 22}px`);
      event.currentTarget.style.setProperty("--parallax-y", `${(0.5 - y) * 16}px`);
      event.currentTarget.style.setProperty("--parallax-x-soft", `${(0.5 - x) * 10}px`);
      event.currentTarget.style.setProperty("--parallax-y-soft", `${(0.5 - y) * 7}px`);
    }} onPointerLeave={(event) => {
      pointerRef.current = { x: 0.5, y: 0.5 };
      event.currentTarget.style.setProperty("--parallax-x", "0px");
      event.currentTarget.style.setProperty("--parallax-y", "0px");
      event.currentTarget.style.setProperty("--parallax-x-soft", "0px");
      event.currentTarget.style.setProperty("--parallax-y-soft", "0px");
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

      <section className={styles.orbitStage} aria-label="Interactive universe" data-world={selected}>
        <div className={styles.halo} aria-hidden="true" />
        {sceneTarget("galaxies", `${styles.galaxy} ${styles.sceneGalaxy}`, "galaxies", <><i /><i /><i /></>)}
        {sceneTarget("planets", `${styles.planet} ${styles.planetOne}`, "a planet")}
        {sceneTarget("moons", `${styles.planet} ${styles.planetMoon}`, "a moon")}
        {sceneTarget("planets", `${styles.planet} ${styles.planetTwo}`, "a blue planet")}
        {sceneTarget("solar-systems", styles.solarOrbit, "a solar system", <><i /><i /><i /></>)}
        {sceneTarget("asteroids-comets", styles.cometTrail, "a passing comet")}
        {sceneTarget("black-holes", styles.blackHole, "a black hole", <i />)}
        {sceneTarget("stars", styles.starObject, "a star")}
        {sceneTarget("nebulae", styles.nebulaObject, "a nebula")}
        {sceneTarget("dark-matter", styles.darkMatterLens, "dark matter")}
        {sceneTarget("dark-energy", styles.darkEnergyWave, "dark energy")}
        {sceneTarget("space-time", styles.spaceTimeGrid, "space-time")}
        {sceneTarget("matter-energy", styles.energyField, "matter and energy")}
        <button className={`${styles.world} ${styles.worldGalaxy} ${selected === "galaxies" ? styles.chosen : ""}`} onClick={() => choose("galaxies")} aria-pressed={selected === "galaxies"}>Galaxies</button>
        <button className={`${styles.world} ${styles.worldStar} ${selected === "stars" ? styles.chosen : ""}`} onClick={() => choose("stars")} aria-pressed={selected === "stars"}>Stars</button>
        <button className={`${styles.world} ${styles.worldPlanet} ${selected === "planets" ? styles.chosen : ""}`} onClick={() => choose("planets")} aria-pressed={selected === "planets"}>Planets</button>
        <button className={`${styles.world} ${styles.worldHole} ${selected === "black-holes" ? styles.chosen : ""}`} onClick={() => choose("black-holes")} aria-pressed={selected === "black-holes"}>Black holes</button>
        <button className={`${styles.world} ${styles.worldNebula} ${selected === "nebulae" ? styles.chosen : ""}`} onClick={() => choose("nebulae")} aria-pressed={selected === "nebulae"}>Nebulae</button>
        <button className={`${styles.world} ${styles.worldComet} ${selected === "asteroids-comets" ? styles.chosen : ""}`} onClick={() => choose("asteroids-comets")} aria-pressed={selected === "asteroids-comets"}>Asteroids &amp; comets</button>
        <button className={`${styles.world} ${styles.worldEnergy} ${selected === "matter-energy" ? styles.chosen : ""}`} onClick={() => choose("matter-energy")} aria-pressed={selected === "matter-energy"}>Matter &amp; energy</button>
      </section>

      <section className={styles.detail} aria-live="polite" aria-atomic="true">
        <div className={styles.detailCopy}><span className={styles.detailEyebrow}>NOW EXPLORING · {String(worlds.findIndex((world) => world.id === selected) + 1).padStart(2, "0")} / 12</span><h2>{active.name}</h2><p>{active.note}</p><p className={styles.fact}><strong>A COSMIC FACT</strong> {active.fact}</p><p className={styles.guide}><strong>AAHANA'S FIELD NOTE</strong> {active.guide}</p></div>
        <div className={styles.detailMark} style={{ "--world-color": active.color }} aria-hidden="true" />
      </section>
      <div className={styles.journeyControls} aria-label="Guided universe journey">
        <button type="button" onClick={() => moveJourney(-1)} aria-label="Explore previous cosmic subject">← Previous</button>
        <span>{journeyStarted ? "KEEP EXPLORING" : "12 WORLDS · ONE UNIVERSE"}</span>
        <button type="button" onClick={() => moveJourney(1)} aria-label="Explore next cosmic subject">Next world →</button>
      </div>

      <nav className={styles.worldList} aria-label="Choose a cosmic element">
        {worlds.map((world) => <button type="button" key={world.id} onClick={() => choose(world.id)} className={selected === world.id ? styles.activeWorld : ""} aria-pressed={selected === world.id}>{world.name}</button>)}
      </nav>

      <footer className={styles.footer}>
        <span>SPACE IS NOT A BACKGROUND. IT IS THE EXPERIENCE.</span>
        <button type="button" onClick={() => setMotion((value) => !value)} aria-pressed={!motion}>{motion ? "Pause motion" : "Resume motion"}</button>
      </footer>
    </main>
  );
}
