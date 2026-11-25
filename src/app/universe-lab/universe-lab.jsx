"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./universe-lab.module.css";

const worlds = [
  { id: "galaxies", name: "Galaxies", note: "Vast island universes, each holding billions of stars.", fact: "The Milky Way is a barred spiral galaxy, one among an enormous cosmic population.", guide: "Trace the spiral arms outward and notice how gravity gathers stars into vast structures.", experiment: "If you could watch a galaxy for a million years, what evidence would tell you its stars are orbiting a shared centre?", color: "#c7a7ff" },
  { id: "stars", name: "Stars", note: "Stellar nurseries, brilliant suns and the light between them.", fact: "Stars shine because nuclear fusion in their cores releases energy as light and heat.", guide: "Compare a star's colour and brightness; these clues help astronomers estimate its temperature and life stage.", experiment: "Two stars look equally bright from Earth. What else would you need to know before deciding which one is more luminous?", color: "#ffe2ad" },
  { id: "planets", name: "Planets", note: "Worlds with their own colour, atmosphere and character.", fact: "Planets form in disks of gas and dust around young stars.", guide: "Look for differences in atmosphere, surface and orbit to understand why worlds evolve differently.", experiment: "A distant planet passes in front of its star. What could a tiny dip in starlight reveal about that planet?", color: "#8db9ff" },
  { id: "moons", name: "Moons", note: "Natural satellites orbiting planets, from icy worlds to cratered landscapes.", fact: "Some moons may hide vast oceans beneath icy crusts.", guide: "Consider what tides, ice and internal heating might reveal about hidden environments beneath a moon's surface.", experiment: "An icy moon flexes as it orbits a giant planet. How might that repeated squeezing keep an underground ocean warm?", color: "#d9d4ff" },
  { id: "solar-systems", name: "Solar systems", note: "Stars and the families of planets, moons, rings and smaller bodies around them.", fact: "Our solar system formed about 4.6 billion years ago from a rotating cloud of gas and dust.", guide: "Follow each orbit around its star; the distance and orbital period help define a system's architecture.", experiment: "A planet takes twice as long to orbit its star as another. What might its orbital distance tell you about the system?", color: "#ffc98c" },
  { id: "black-holes", name: "Black holes", note: "Regions where gravity bends space-time so intensely that not even light escapes beyond the event horizon.", fact: "The event horizon is the boundary beyond which escape is impossible—not a solid surface.", guide: "Focus on the glowing ring: light can bend around a black hole even though light cannot escape from inside its event horizon.", experiment: "Imagine a beam of light passing close to a black hole. How would its path differ from a beam travelling far away?", color: "#d6b5ff" },
  { id: "nebulae", name: "Nebulae", note: "Cosmic clouds of gas and dust, including stellar nurseries where new stars form.", fact: "Nebulae can be stellar nurseries or the expanding remains of stars.", guide: "Look for dense clouds and glowing regions where gravity can help gas collapse into new stars.", experiment: "A cold cloud of gas begins to contract under gravity. What changes might eventually allow a new star to ignite?", color: "#ff9fd7" },
  { id: "asteroids-comets", name: "Asteroids & comets", note: "Rocky and icy travellers moving through planetary space.", fact: "A comet's tail points generally away from the Sun as sunlight warms its icy nucleus.", guide: "Compare rocky asteroids with icy comets; their different materials create very different journeys near the Sun.", experiment: "A comet grows a bright tail near its star. Why might the tail point away even while the comet travels in another direction?", color: "#9fe9e4" },
  { id: "space-time", name: "Space & time", note: "The four-dimensional fabric in which every cosmic event takes place.", fact: "In general relativity, mass and energy shape space-time, and that geometry guides motion.", guide: "Imagine a grid bending around mass: in relativity, objects follow paths through curved space-time.", experiment: "Imagine placing a clock close to a very massive object and comparing it with a distant clock. What difference might relativity predict?", color: "#a8c4ff" },
  { id: "matter-energy", name: "Matter & energy", note: "The physical ingredients and processes that make the cosmos dynamic.", fact: "Mass and energy are linked by E = mc².", guide: "Think of energy as something that can change form; mass and energy are linked, not separate ingredients.", experiment: "If a small amount of mass could be converted completely into energy, what does E = mc² tell you about the scale of energy involved?", color: "#ffdb9e" },
  { id: "dark-matter", name: "Dark matter", note: "Invisible matter inferred from its gravitational influence on galaxies and cosmic structure.", fact: "We infer dark matter through gravity, including galaxy rotation and gravitational lensing.", guide: "Notice the lensing pattern: invisible mass can reveal itself by bending light from more distant objects.", experiment: "A galaxy's outer stars orbit faster than visible matter alone seems to explain. What unseen influence could account for the motion?", color: "#9b8bff" },
  { id: "dark-energy", name: "Dark energy", note: "The name for the unknown cause of the universe's accelerated expansion.", fact: "Dark energy names the unknown cause of the observed acceleration of cosmic expansion.", guide: "Imagine distant galaxies separating faster over cosmic time; the cause of that accelerated expansion remains unknown.", experiment: "If the universe expands while galaxies move farther apart, what observations could help distinguish steady expansion from accelerated expansion?", color: "#88c9ff" },
];

const companionQuestions = {
  galaxies: ["How do spiral arms form and persist?", "How do astronomers map a galaxy we are inside?", "What evidence reveals a galaxy's central black hole?"],
  stars: ["How does a star's mass determine its lifetime?", "What can a star's spectrum tell us?", "How are elements heavier than helium created?"],
  planets: ["How can we detect an exoplanet without seeing it directly?", "What makes a planet potentially habitable?", "How do planetary atmospheres evolve?"],
  moons: ["What evidence could reveal an ocean beneath ice?", "How do tidal forces heat a moon?", "Could a moon support conditions for life?"],
  "solar-systems": ["Why do planets farther from a star usually take longer to orbit?", "How do astronomers discover unseen planets?", "What can orbital resonances reveal about a system?"],
  "black-holes": ["What would an observer see near an event horizon?", "How does gravitational lensing reveal invisible mass?", "What happens to matter in an accretion disk?"],
  nebulae: ["What triggers a cloud to collapse into a star?", "How do newborn stars reshape their nebula?", "What is the difference between an emission and reflection nebula?"],
  "asteroids-comets": ["How are asteroid families formed?", "Why do comet tails point away from the Sun?", "What can meteorites tell us about the early solar system?"],
  "space-time": ["Why does gravity affect the passage of time?", "How do gravitational waves carry information?", "What does it mean for space-time to be curved?"],
  "matter-energy": ["How does fusion turn mass into radiant energy?", "Where does the energy in sunlight originate?", "How are mass and energy measured in modern physics?"],
  "dark-matter": ["What observations support the dark-matter hypothesis?", "How does gravitational lensing map unseen mass?", "What experiments are trying to detect dark matter directly?"],
  "dark-energy": ["How do astronomers measure cosmic expansion?", "What observations indicate expansion is accelerating?", "Why is the physical nature of dark energy still unknown?"],
};

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
  const [experimentOpen, setExperimentOpen] = useState(false);
  const [companionQuestion, setCompanionQuestion] = useState("");
  const [companionStatus, setCompanionStatus] = useState("");
  const [creationFormat, setCreationFormat] = useState("visual");
  const [creationDirection, setCreationDirection] = useState("");
  const [creationStatus, setCreationStatus] = useState("");
  const [creationPreview, setCreationPreview] = useState("");
  const [comparisonId, setComparisonId] = useState("stars");
  const [comparisonQuestion, setComparisonQuestion] = useState("How are these two cosmic ideas connected, and where do they differ?");
  const [comparisonStatus, setComparisonStatus] = useState("");
  const [comparisonPreview, setComparisonPreview] = useState("");
  const [projectTitle, setProjectTitle] = useState("A journey through the hidden architecture of the universe");
  const [projectSubjects, setProjectSubjects] = useState(["galaxies", "stars", "dark-matter"]);
  const [projectFormat, setProjectFormat] = useState("learning");
  const [projectDirection, setProjectDirection] = useState("");
  const [projectStatus, setProjectStatus] = useState("");
  const [projectPreview, setProjectPreview] = useState("");
  const [gravityMass, setGravityMass] = useState(5);
  const [gravityDistance, setGravityDistance] = useState(5);
  const [rayRun, setRayRun] = useState(0);
  const [starMass, setStarMass] = useState(5);
  const [orbitDistance, setOrbitDistance] = useState(5);
  const orbitalPeriod = Math.sqrt((orbitDistance ** 3) / starMass);
  const orbitRadiusX = 40 + orbitDistance * 7;
  const orbitRadiusY = 20 + orbitDistance * 3.5;
  const gravityBend = Math.min(70, (gravityMass * 13) / (gravityDistance * 0.55 + 0.4));
  const rayControlY = 22 + gravityBend * 1.4;
  const active = worlds.find((world) => world.id === selected) || worlds[0];
  const choose = (id) => { setSelected(id); setJourneyStarted(true); setExperimentOpen(false); setCompanionQuestion(""); setCompanionStatus(""); };
  const copyCompanionPrompt = async () => {
    const question = companionQuestion.trim();
    if (!question) return;
    const prompt = `Aahana, guide me deeper into ${active.name}. Context: ${active.fact} Your field note: ${active.guide} My question: ${question} Please explain clearly, build from first principles, and suggest one small way to explore this idea further.`;
    try {
      await navigator.clipboard.writeText(prompt);
      setCompanionStatus("Question copied. Paste it into Aahana's assistant to continue.");
    } catch {
      setCompanionStatus("Clipboard access is unavailable here. Select and copy the question manually.");
    }
  };
  const copyCreationBrief = async () => {
    const formats = {
      visual: "Create a richly art-directed visual concept. Describe composition, palette, lighting, scale, atmosphere and the key scientific details to preserve.",
      diagram: "Create a clear educational infographic or labelled diagram. Organize the idea into a logical visual hierarchy, explain relationships and include concise labels.",
      story: "Create an imaginative but scientifically grounded scene or short narrative that helps someone feel the scale and wonder of this subject.",
      research: "Create a structured research outline with key questions, established evidence, open uncertainties and reliable directions for further investigation.",
    };
    const direction = creationDirection.trim();
    const prompt = `Aahana, turn this discovery into a ${creationFormat} creation about ${active.name}.
      Cosmic context: ${active.note}
      Scientific anchor: ${active.fact}
      Explorer's field note: ${active.guide}
      Creative brief: ${formats[creationFormat]}
      Additional direction: ${direction || "Choose a compelling direction suitable for a curious general audience."}
      Keep established science distinct from speculation. Make the result engaging, specific and useful.`;
    try {
      await navigator.clipboard.writeText(prompt);
      setCreationPreview("");
      setCreationStatus("Brief copied. Paste it into Aahana to continue with this creation.");
    } catch {
      setCreationPreview(prompt);
      setCreationStatus("Clipboard unavailable. Your prepared brief is shown below for manual copying.");
    }
  };
  const comparisonWorld = worlds.find((world) => world.id === comparisonId && world.id !== selected)
    || worlds[(worlds.findIndex((world) => world.id === selected) + 1) % worlds.length];
  const copyComparisonBrief = async () => {
    const question = comparisonQuestion.trim();
    if (!question) return;
    const prompt = `Aahana, help me connect these two discoveries through a careful scientific comparison.

      WORLD A — ${active.name}
      Context: ${active.note}
      Scientific anchor: ${active.fact}
      Field note: ${active.guide}

      WORLD B — ${comparisonWorld.name}
      Context: ${comparisonWorld.note}
      Scientific anchor: ${comparisonWorld.fact}
      Field note: ${comparisonWorld.guide}

      My comparison question: ${question}

      Build a clear synthesis: identify the underlying physical principles, meaningful similarities, important differences, and how the two ideas influence or relate to one another. Give one grounded analogy, flag where the analogy breaks down, distinguish established evidence from open questions, and finish with one experiment or observation that could deepen understanding. Do not invent a causal connection where none is established.`;
    try {
      await navigator.clipboard.writeText(prompt);
      setComparisonPreview("");
      setComparisonStatus("Comparison brief copied. Paste it into Aahana to explore the connection.");
    } catch {
      setComparisonPreview(prompt);
      setComparisonStatus("Clipboard unavailable. Your comparison brief is shown below for manual copying.");
    }
  };
  const toggleProjectSubject = (id) => {
    setProjectSubjects((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : current.length < 6 ? [...current, id] : current);
    setProjectStatus("");
    setProjectPreview("");
  };
  const copyKnowledgeProject = async () => {
    const chosenWorlds = worlds.filter((world) => projectSubjects.includes(world.id));
    if (chosenWorlds.length < 2 || !projectTitle.trim()) return;
    const sourceNotes = chosenWorlds.map((world, index) =>
      `SOURCE ${index + 1} — ${world.name}\nContext: ${world.note}\nScientific anchor: ${world.fact}\nExplorer's field note: ${world.guide}`
    ).join("\n\n");
    const formatInstructions = {
      learning: "Build a coherent learning project with a clear learning goal, an accessible sequence of sections, key concepts, cross-links, reflection questions and a concise synthesis.",
      creative: "Build a coherent creative project with a central concept, narrative arc, visual language, scene or chapter structure, and science-grounded creative choices.",
      research: "Build a research project with a central question, sub-questions, established evidence, competing explanations where relevant, uncertainties, a structured outline and suggested observations. Do not fabricate sources or findings.",
      presentation: "Build a presentation plan with a compelling opening, logical slide sequence, concise key messages, suggested diagrams, transitions and a closing synthesis.",
    };
    const prompt = `Aahana, help me assemble a connected project from these discoveries.

PROJECT TITLE: ${projectTitle.trim()}
PROJECT TYPE: ${projectFormat}
USER DIRECTION: ${projectDirection.trim() || "Create a clear, engaging project for a curious general audience."}

SELECTED DISCOVERIES (${chosenWorlds.length}):
${sourceNotes}

PROJECT INSTRUCTIONS:
${formatInstructions[projectFormat]}
Connect the selected subjects through defensible scientific relationships. Do not imply that every subject has a direct causal link. Separate established facts, useful analogies and open questions. Preserve the individual identity of each subject while building a meaningful overall structure. End with a short synthesis explaining what the discoveries reveal together and identify the most valuable next question.`;
    try {
      await navigator.clipboard.writeText(prompt);
      setProjectPreview("");
      setProjectStatus("Project brief copied. Paste it into Aahana to build the full project.");
    } catch {
      setProjectPreview(prompt);
      setProjectStatus("Clipboard unavailable. Your complete project brief is shown below for manual copying.");
    }
  };
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
      <section className={styles.companion} aria-label="Aahana exploration companion">
        <div className={styles.companionTop}><div><span className={styles.detailEyebrow}>YOUR COSMIC COMPANION</span><h2>Where should curiosity take you?</h2><p>Choose a question and take this discovery into a deeper conversation with Aahana.</p></div><span className={styles.companionOrb} aria-hidden="true">✦</span></div>
        <div className={styles.companionQuestions}>
          {(companionQuestions[selected] || companionQuestions.galaxies).map((question) => <button type="button" key={question} className={companionQuestion === question ? styles.companionQuestionActive : ""} onClick={() => { setCompanionQuestion(question); setCompanionStatus(""); }} aria-pressed={companionQuestion === question}>{question}<span>↗</span></button>)}
        </div>
        <label className={styles.companionCustom}>Or write your own question
          <textarea value={companionQuestion} maxLength={240} rows={2} onChange={(event) => { setCompanionQuestion(event.target.value); setCompanionStatus(""); }} placeholder={`What would you like to understand about ${active.name.toLowerCase()}?`} />
        </label>
        <div className={styles.companionActions}><span role="status" aria-live="polite">{companionStatus}</span><button type="button" onClick={copyCompanionPrompt} disabled={!companionQuestion.trim()}>Ask Aahana ↗</button></div>
        <p className={styles.gravityCaution}>This prepares a context-rich question for the existing assistant. It does not send a message or change your conversation until you paste and send it.</p>
      </section>

      <section className={styles.creationBridge} aria-label="Turn a discovery into a creation">
        <div className={styles.creationHeader}>
          <div><span className={styles.detailEyebrow}>DISCOVERY → CREATION</span><h2>Give this idea another form.</h2><p>Turn what you have explored into a visual, a learning diagram, a story or a research path.</p></div>
          <span className={styles.creationGlyph} aria-hidden="true">✧</span>
        </div>
        <label className={styles.creationField}>Choose what Aahana should prepare
          <select value={creationFormat} onChange={(event) => { setCreationFormat(event.target.value); setCreationStatus(""); }}>
            <option value="visual">Visual concept</option>
            <option value="diagram">Infographic / diagram</option>
            <option value="story">Creative scene / story</option>
            <option value="research">Research outline</option>
          </select>
        </label>
        <label className={styles.creationField}>Your creative direction <span>Optional</span>
          <textarea value={creationDirection} maxLength={320} rows={2} onChange={(event) => { setCreationDirection(event.target.value); setCreationStatus(""); }} placeholder={`e.g. Show how ${active.name.toLowerCase()} shape the structure of the universe...`} />
        </label>
        <div className={styles.creationActions}><span role="status" aria-live="polite">{creationStatus}</span><button type="button" onClick={copyCreationBrief}>Prepare creation brief ↗</button></div>
        {creationPreview && <label className={styles.creationField}>Your prepared brief<textarea readOnly value={creationPreview} rows={7} onFocus={(event) => event.target.select()} /></label>}
        <p className={styles.gravityCaution}>This prepares a context-rich brief only. It does not start image, video or research generation, call a provider, or alter an existing conversation.</p>
      </section>

      <section className={styles.comparisonLab} aria-label="Connect two cosmic discoveries">
        <div className={styles.comparisonHeader}>
          <div><span className={styles.detailEyebrow}>CROSS-UNIVERSE THINKING</span><h2>What connects these worlds?</h2><p>Compare the world you are exploring with another subject. Look for shared principles without flattening their differences.</p></div>
          <span className={styles.comparisonGlyph} aria-hidden="true">⇄</span>
        </div>
        <div className={styles.comparisonPair}>
          <div className={styles.comparisonWorld}><span>WORLD A · CURRENT</span><strong>{active.name}</strong></div>
          <label className={styles.comparisonWorld}>WORLD B · COMPARE WITH
            <select value={comparisonWorld.id} onChange={(event) => { setComparisonId(event.target.value); setComparisonStatus(""); setComparisonPreview(""); }}>
              {worlds.filter((world) => world.id !== selected).map((world) => <option key={world.id} value={world.id}>{world.name}</option>)}
            </select>
          </label>
        </div>
        <div className={styles.comparisonFacts}>
          <p><strong>{active.name}</strong>{active.fact}</p>
          <p><strong>{comparisonWorld.name}</strong>{comparisonWorld.fact}</p>
        </div>
        <label className={styles.creationField}>What would you like to understand?
          <textarea value={comparisonQuestion} maxLength={280} rows={2} onChange={(event) => { setComparisonQuestion(event.target.value); setComparisonStatus(""); setComparisonPreview(""); }} />
        </label>
        <div className={styles.creationActions}><span role="status" aria-live="polite">{comparisonStatus}</span><button type="button" onClick={copyComparisonBrief} disabled={!comparisonQuestion.trim()}>Prepare comparison ↗</button></div>
        {comparisonPreview && <label className={styles.creationField}>Your prepared comparison brief<textarea readOnly value={comparisonPreview} rows={9} onFocus={(event) => event.target.select()} /></label>}
        <p className={styles.gravityCaution}>A guided synthesis prompt only. It does not claim a connection exists, perform research, send a message or change a conversation.</p>
      </section>

      <section className={styles.knowledgeProject} aria-label="Build a knowledge constellation project">
        <div className={styles.knowledgeHeader}>
          <div><span className={styles.detailEyebrow}>KNOWLEDGE CONSTELLATION · PROJECT BUILDER</span><h2>Bring your discoveries together.</h2><p>Choose two to six worlds and turn their discoveries into one connected learning, creative or research project.</p></div>
          <span className={styles.knowledgeGlyph} aria-hidden="true">✧</span>
        </div>
        <label className={styles.creationField}>Project title
          <input value={projectTitle} maxLength={100} onChange={(event) => { setProjectTitle(event.target.value); setProjectStatus(""); setProjectPreview(""); }} />
        </label>
        <div className={styles.knowledgePicker}>
          <div className={styles.knowledgePickerTop}><span>ADD DISCOVERIES</span><span>{projectSubjects.length} / 6 selected · choose at least 2</span></div>
          <div className={styles.knowledgeChips}>
            {worlds.map((world) => <button type="button" key={world.id} onClick={() => toggleProjectSubject(world.id)} className={projectSubjects.includes(world.id) ? styles.knowledgeChipActive : ""} aria-pressed={projectSubjects.includes(world.id)}>{world.name}<span>{projectSubjects.includes(world.id) ? "✓" : "+"}</span></button>)}
          </div>
        </div>
        <label className={styles.creationField}>Project format
          <select value={projectFormat} onChange={(event) => { setProjectFormat(event.target.value); setProjectStatus(""); setProjectPreview(""); }}>
            <option value="learning">Connected learning journey</option>
            <option value="creative">Creative universe / story</option>
            <option value="research">Research project outline</option>
            <option value="presentation">Presentation structure</option>
          </select>
        </label>
        <label className={styles.creationField}>Your project direction <span>Optional</span>
          <textarea value={projectDirection} maxLength={400} rows={2} onChange={(event) => { setProjectDirection(event.target.value); setProjectStatus(""); setProjectPreview(""); }} placeholder="What should this project help someone understand, imagine or investigate?" />
        </label>
        <div className={styles.knowledgeActions}><span role="status" aria-live="polite">{projectStatus}</span><button type="button" onClick={copyKnowledgeProject} disabled={projectSubjects.length < 2 || !projectTitle.trim()}>Assemble project brief ↗</button></div>
        {projectPreview && <label className={styles.creationField}>Your complete project brief<textarea readOnly value={projectPreview} rows={12} onFocus={(event) => event.target.select()} /></label>}
        <p className={styles.gravityCaution}>Your project is assembled from the selected Universe Lab notes in this page session. It is not saved to an account, does not create a file, and does not send or generate anything automatically.</p>
      </section>

      <section className={styles.experiment} aria-label="Cosmic thought experiment">
        <div className={styles.experimentHeading}><span>THINK LIKE AN EXPLORER</span><button type="button" onClick={() => setExperimentOpen((value) => !value)} aria-expanded={experimentOpen}>{experimentOpen ? "Close experiment −" : "Try a thought experiment +"}</button></div>
        {experimentOpen && <div className={styles.experimentPrompt}><p>{active.experiment}</p><span>Take a moment to form your own explanation. There is more than one useful question to ask.</span></div>}
      </section>

      {selected === "black-holes" && <section className={styles.gravityLab} aria-label="Black-hole gravity experiment">
        <div className={styles.gravityHeader}><div><span className={styles.detailEyebrow}>INTERACTIVE PHYSICS · CONCEPTUAL MODEL</span><h2>Gravity Lab</h2><p>Change the black hole and the passing light ray. Watch how the path bends.</p></div><span className={styles.gravityTag}>LIGHT PATH</span></div>
        <svg key={rayRun} className={styles.gravityDiagram} viewBox="0 0 300 132" role="img" aria-label={`Conceptual light path bending around a black hole. Mass ${gravityMass} of 10, approach distance ${gravityDistance} of 10.`} data-run={rayRun}>
          <defs><radialGradient id="gravityGlow"><stop offset="0" stopColor="#b99aff" stopOpacity=".42"/><stop offset="1" stopColor="#b99aff" stopOpacity="0"/></radialGradient></defs>
          <ellipse cx="150" cy="78" rx="63" ry="44" fill="url(#gravityGlow)"/>
          <ellipse cx="150" cy="78" rx="35" ry="9" fill="none" stroke="#c6a8ff" strokeOpacity=".75" strokeWidth="2" transform="rotate(-17 150 78)"/>
          <path d={`M 8 22 Q 150 ${rayControlY.toFixed(1)} 292 22`} className={styles.rayPath} fill="none" stroke="#b8f4ff" strokeWidth="2.2" strokeLinecap="round"/>
          <circle cx="150" cy="78" r="19" fill="#030207" stroke="#a98bd8" strokeOpacity=".8" strokeWidth="1.5"/>

          <circle cx="8" cy="22" r="3" fill="#e8fcff"/><circle cx="292" cy="22" r="3" fill="#e8fcff"/>
          <text x="8" y="12" fill="#a99bbd" fontSize="7">LIGHT IN</text><text x="292" y="12" fill="#a99bbd" fontSize="7" textAnchor="end">LIGHT OUT</text>
        </svg>
        <div className={styles.gravityControls}>
          <label>Black-hole mass <output>{gravityMass} / 10</output><input type="range" min="1" max="10" step="1" value={gravityMass} onChange={(event) => setGravityMass(Number(event.target.value))} /></label>
          <label>Light-ray distance <output>{gravityDistance} / 10 · {gravityDistance <= 3 ? "Close" : gravityDistance >= 8 ? "Far" : "Mid-range"}</output><input type="range" min="1" max="10" step="1" value={gravityDistance} onChange={(event) => setGravityDistance(Number(event.target.value))} /></label>
        </div>
        <div className={styles.gravityFooter}><span>Greater mass and a closer pass produce stronger bending in this simplified illustration.</span><button type="button" onClick={() => setRayRun((value) => value + 1)}>Trace light path ↗</button></div>
        <p className={styles.gravityCaution}>Learning model only: real gravitational lensing depends on the space-time geometry and the ray’s full trajectory.</p>
      </section>}

      {selected === "solar-systems" && <section className={styles.orbitLab} aria-label="Planetary orbit experiment">
        <div className={styles.gravityHeader}><div><span className={styles.detailEyebrow}>INTERACTIVE ASTRONOMY · KEPLER'S THIRD LAW</span><h2>Orbit Lab</h2><p>Change the star's mass and a planet's orbital distance. Compare the relative time needed for one orbit.</p></div><span className={styles.gravityTag}>ORBIT MODEL</span></div>
        <svg className={styles.orbitDiagram} viewBox="0 0 300 160" role="img" aria-label={`A planet orbiting a star. Star mass ${starMass} relative units; orbital distance ${orbitDistance} relative units.`}>
          <ellipse cx="150" cy="80" rx={orbitRadiusX} ry={orbitRadiusY} fill="none" stroke="#b99aff" strokeOpacity=".55" strokeWidth="1.5" strokeDasharray="4 5"/>
          <circle cx="150" cy="80" r={6 + starMass * 1.1} fill="#ffd89b" filter="url(#starGlow)"/>
          <defs><filter id="starGlow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
          <circle cx={150 + orbitRadiusX} cy="80" r="5" fill="#a9d5ff" stroke="#e4f3ff" strokeWidth="1"/>
          <circle cx="150" cy="80" r="2" fill="#fff5d9"/>
          <text x="150" y="151" fill="#9488a8" fontSize="7" textAnchor="middle">ILLUSTRATIVE · NOT TO SCALE</text>
        </svg>
        <div className={styles.orbitReadout}><span>RELATIVE ORBITAL PERIOD</span><strong>{orbitalPeriod.toFixed(1)} <small>time units</small></strong><em>Longer distance → longer orbit. Greater star mass → shorter orbit.</em></div>
        <div className={styles.gravityControls}>
          <label>Star mass <output>{starMass} / 10</output><input type="range" min="1" max="10" step="1" value={starMass} onChange={(event) => setStarMass(Number(event.target.value))}/></label>
          <label>Orbital distance <output>{orbitDistance} / 10</output><input type="range" min="1" max="10" step="1" value={orbitDistance} onChange={(event) => setOrbitDistance(Number(event.target.value))}/></label>
        </div>
        <div className={styles.gravityFooter}><span>Based on the proportional relationship T² ∝ a³ / M, using relative units for learning.</span><button type="button" onClick={() => { setStarMass(5); setOrbitDistance(5); }}>Reset system ↺</button></div>
        <p className={styles.gravityCaution}>Simplified two-body model: real systems can be affected by other planets, eccentric orbits and additional gravitational interactions.</p>
      </section>}

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
