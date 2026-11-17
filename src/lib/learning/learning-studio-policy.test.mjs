import test from "node:test";
import assert from "node:assert/strict";
import "./learning-memory.test.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const routePath = fileURLToPath(new URL("../../app/api/chat/route.js", import.meta.url));
const studioPath = fileURLToPath(new URL("../../app/learn/learning-studio.jsx", import.meta.url));
const animatedPath = fileURLToPath(new URL("../../app/learn/animated-lesson.jsx", import.meta.url));
const learningMemoryPath = fileURLToPath(new URL("../../app/api/learning-journey/route.js", import.meta.url));
const route = readFileSync(routePath, "utf8");
const studio = readFileSync(studioPath, "utf8");
const animated = readFileSync(animatedPath, "utf8");
const learningMemoryRoute = readFileSync(learningMemoryPath, "utf8");
const stylesPath = fileURLToPath(new URL("../../app/learn/learning-studio.css", import.meta.url));
const styles = readFileSync(stylesPath, "utf8");

test("chat API accepts the dedicated learn mode and validates learner profile fields", () => {
  assert.match(route, /"improve",\s*"learn"/);
  assert.match(route, /allowedGradeBands/);
  assert.match(route, /allowedLearningModes/);
  assert.match(route, /allowedLearningSubjects/);
  assert.match(route, /allowedCurricula/);
  assert.match(route, /curriculum: allowedCurricula/);
  assert.match(route, /\\p\{L\}/);
  assert.match(route, /mode === "learn" \?/);
  assert.match(route, /learningProfile\.language/);
});

test("learning instructions are included in the actual model system prompt", () => {
  const start = route.indexOf("const systemPrompt = [");
  const end = route.indexOf("].join(\" \");", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const systemPrompt = route.slice(start, end);
  for (const phrase of [
    "Aahana Learning Studio",
    "Adapt the vocabulary, examples",
    "wait for the learner's attempt",
    "Correct misconceptions gently",
    "Never pretend media was created",
  ]) assert.ok(systemPrompt.includes(phrase), `Missing learning policy: ${phrase}`);
});

test("student studio exposes all six agreed learning experiences", () => {
  for (const phrase of [
    "Story Mode", "Visual Explainer", "Play & Solve",
    "Adventure Mode", "Talk & Learn", "Create & Experiment",
  ]) assert.ok(studio.includes(phrase), `Missing learning experience: ${phrase}`);
  assert.match(studio, /Learning level/);
  assert.match(studio, /Learning language/);
  assert.match(studio, /Curriculum \/ education board/);
  assert.match(studio, /curriculum, language, learningMode/);
  assert.match(studio, /Choose a subject or topic/);
});

test("learning sessions use the authenticated chat endpoint and persist under learn mode", () => {
  assert.match(studio, /fetch\("\/api\/chat"/);
  assert.match(studio, /mode: "learn"/);
  assert.match(studio, /learningProfile: profile/);
});

test("learning studio lists only learn-mode sessions and resumes through the owner-scoped conversation API", () => {
  assert.match(studio, /fetch\("\/api\/conversations"/);
  assert.match(studio, /filter\(\(item\) => item\.mode === "learn"\)/);
  assert.match(studio, /fetch\("\/api\/conversations\/" \+ encodeURIComponent\(id\)/);
  assert.match(studio, /result\.conversation\?\.mode !== "learn"/);
  assert.match(studio, /setMessages\(\(result\.messages \|\| \[\]\)\.map/);
});

test("learner preferences are saved per conversation and restored when resuming on the same device", () => {
  assert.match(studio, /localStorage\.setItem\("aahana:learning-profile:" \+ nextId/);
  assert.match(studio, /localStorage\.getItem\("aahana:learning-profile:" \+ result\.conversation\.id/);
  assert.match(studio, /setGradeBand\(savedProfile\.gradeBand\)/);
  assert.match(studio, /setSubject\(savedProfile\.subject\)/);
  assert.match(studio, /setLearningMode\(savedProfile\.learningMode\)/);
});

test("curriculum selection is restored with the learner profile and handled cautiously by the tutor", () => {
  assert.match(studio, /curricula\.includes\(savedProfile\.curriculum\)/);
  assert.match(studio, /setCurriculum\(savedProfile\.curriculum\)/);
  assert.match(route, /Curriculum: \$\{learningProfile\.curriculum\}/);
  assert.match(route, /Do not claim exact syllabus alignment or exam-board coverage unless verified/);
});

test("Play and Solve requests a strict structured quiz from the tutor", () => {
  assert.match(route, /learningProfile\.learningMode === "play"/);
  assert.match(route, /type set to aahana_quiz_v1/);
  assert.match(route, /correctIndex \(integer 0 to 3\)/);
  assert.match(route, /exactly four distinct strings/);
});

test("Learning Studio validates and renders interactive quizzes with feedback and scoring", () => {
  assert.match(studio, /function readQuizPayload\(content\)/);
  assert.match(studio, /value\?\.type !== "aahana_quiz_v1"/);
  assert.match(studio, /item\.options\.length === 4/);
  assert.match(studio, /Number\.isInteger\(item\.correctIndex\)/);
  assert.match(studio, /function InteractiveQuiz\(\{ quiz \}\)/);
  assert.match(studio, /function choose\(index, optionIndex\)/);
  assert.match(studio, /discovered/);
  assert.match(studio, /Play again/);
});

test("Play and Solve keeps incomplete streamed quiz JSON out of the visible conversation", () => {
  assert.match(studio, /Building your quiz/);
  assert.match(studio, /busy && index === messages\.length - 1/);
});

test("all learning modes receive animation-first visual teaching and non-shaming encouragement rules", () => {
  assert.match(route, /ANIMATION-FIRST LEARNING/);
  assert.match(route, /scene-by-scene directions/);
  assert.match(route, /KINDNESS AND MOTIVATION/);
  assert.match(route, /Never shame, scold, label, rank or discourage a learner/);
  assert.match(route, /give one gentle clue or a simpler visual example/);
});

test("quiz mistakes invite a gentle clue and another attempt without negative labels", () => {
  assert.match(route, /hint \(string\)/);
  assert.match(studio, /typeof item\.hint === "string" && item\.hint\.trim\(\)/);
  assert.match(studio, /item\.visual/);
  assert.match(studio, /<AnimatedVisual visual=\{item\.visual\} \/>/);
  assert.match(studio, /Good exploring!/);
  assert.match(studio, /Here's a little clue:/);
  assert.match(studio, /I'll try again/);
  assert.match(studio, /You figured it out!/);
  assert.doesNotMatch(studio, /Not quite\./);
  assert.doesNotMatch(studio, /className=.*incorrect/);
});

test("learning motion respects reduced-motion accessibility preferences", () => {
  assert.match(styles, /@keyframes learning-icon-float/);
  assert.match(styles, /@keyframes learning-scene-in/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:reduce\)/);
});


test("non-quiz learning modes request a validated structured animated lesson", () => {
  assert.match(route, /ANIMATED LESSON OUTPUT/);
  assert.match(route, /aahana_motion_lesson_v1/);
  assert.match(route, /response_format: \{ type: "json_object" \}/);
  assert.match(route, /SOLAR SYSTEM LEARNING EXPERIENCE/);
  assert.match(route, /not a written presentation script or storyboard/);
  assert.match(route, /3d-solar-system/);
  assert.match(animated, /"3d-solar-system": "solar-system"/);
  assert.match(animated, /Try the interactive lesson again/);
  assert.match(studio, /Building your interactive lesson/);
  assert.match(studio, /startLearning\(null, previousQuestion, false\)/);
  assert.match(route, /visual \(exactly one of fraction, orbit, water-cycle, plant-growth, number-line, molecule, concept-map, timeline, bar-chart, anatomy, circuit, code-flow, sound-wave, map, 3d-solar-system, 3d-planet, 3d-molecule, 3d-atom, 3d-dna, 3d-geometry, 3d-terrain, 3d-plant-cell, 3d-heart, 3d-pyramid, 3d-ecosystem, 3d-engine\)/);
  assert.match(route, /3 to 5 scenes/);
  assert.match(route, /Each challenge must contain question, exactly 3 unique options/);
  assert.match(route, /visualData with label/);
  assert.match(route, /progress \(integer 0 to 100 representing the proportion or stage actually depicted\)/);
  assert.match(route, /support \(object with visual set to a different valid visual type/);
  assert.match(route, /hints array of exactly 2 progressively helpful hints/);
  assert.match(route, /fraction, orbit, water-cycle, plant-growth, number-line, molecule, concept-map/);
  assert.match(studio, /readMotionLesson\(item\.content\)/);
  assert.match(studio, /<AnimatedLesson content=\{item\.content\} memoryEnabled=\{learningMemory\.enabled\} onSaveJourney=\{saveLearningJourney\} \/>/);
});


test("learning memory is opt-in, authenticated, owner-scoped and deletable", () => {
  assert.match(learningMemoryRoute, /supabase\.auth\.getUser\(\)/);
  assert.match(learningMemoryRoute, /memoryIsEnabled\(supabase, user\.id\)/);
  assert.match(learningMemoryRoute, /\.eq\("user_id", user\.id\)/);
  assert.match(learningMemoryRoute, /\.eq\("source", "conversation"\)/);
  assert.match(learningMemoryRoute, /\.like\("content", "learning_journey:%"\)/);
  assert.match(learningMemoryRoute, /Enable private memory before saving/);
  assert.match(learningMemoryRoute, /export async function DELETE/);
  assert.match(studio, /Turn memory on/);
  assert.match(studio, /deleteLearningJourney\(item\.id\)/);
  assert.match(animated, /onSaveJourney\(\{/);
  assert.match(animated, /Save to my journey/);
});

test("learning memory API reports the actual consent setting", () => {
  assert.match(learningMemoryRoute, /return NextResponse\.json\(\{ enabled, journeys \}\)/);
  assert.doesNotMatch(learningMemoryRoute, /return NextResponse\.json\(\{ enabled: true, journeys \}\)/);
});

test("adaptive roadmap is built only from saved learner-selected topics and offers clear next actions", () => {
  assert.match(studio, /const learningRoadmap = learningMemory\.journeys\.reduce/);
  assert.match(studio, /scene\.alternateExplanationUsed/);
  assert.match(studio, /Explore with a fresh explanation/);
  assert.match(studio, /Continue your curiosity/);
  assert.match(studio, /Explore again/);
  assert.match(studio, /Let's explore/);
  assert.match(studio, /Let's continue exploring/);
  assert.match(studio, /invitations—not grades or assumptions/);
});

test("animated lesson renderer validates scene data and provides subject-specific visuals", () => {
  assert.match(animated, /function readMotionLesson\(content\)/);
  assert.match(animated, /value\?\.type !== "aahana_motion_lesson_v1"/);
  assert.match(animated, /value\.scenes\.length < 2/);
  assert.match(animated, /scene\.challenge\.options\.length === 3/);
  assert.match(animated, /scene\.challenge\.correctIndex/);
  assert.match(animated, /scene\.challenge\.hint/);
  assert.match(animated, /scene\.challenge\.explanation/);
  assert.match(animated, /scene\.narration\.length <= 1200/);
  assert.match(animated, /scene\.challenge\.options\.every[\s\S]*option\.length <= 120/);
  assert.match(animated, /scene\.challenge\.explanation\.length <= 500/);
  assert.match(animated, /data\.label\.length <= 90/);
  assert.match(animated, /data\.value\.length <= 36/);
  assert.match(animated, /data\.progress >= 0 && data\.progress <= 100/);
  assert.match(animated, /data\.comparison\.length <= 120/);
  assert.match(animated, /validVisualData\(scene\.support\.visualData\)/);
  assert.match(animated, /scene\.support\.visual !== scene\.visual/);
  assert.match(animated, /scene\.challenge\.hints\.length === 2/);
  assert.match(animated, /const showSupport = attempts >= 2 && !solved/);
  assert.match(animated, /displayedVisual = showSupport \? scene\.support\.visual/);
  assert.match(animated, /scene\.support\.explanation/);
  assert.match(animated, /challenge\.hints\[1\]/);
  assert.match(animated, /const \[sceneAttempts, setSceneAttempts\] = useState\(\{\}\)/);
  assert.match(animated, /const adaptedScenes = Object\.keys\(solvedAttempts\)/);
  assert.match(animated, /setSolvedAttempts\(\(current\) =>/);
  assert.match(animated, /motion-learning-reflection/);
  assert.match(animated, /Explore again/);
  assert.match(animated, /Trying a new way is a powerful learning skill/);
  assert.match(animated, /motion-data-track/);
  for (const visual of ["fraction", "orbit", "water-cycle", "plant-growth", "number-line", "molecule", "concept-map", "timeline", "bar-chart", "anatomy", "circuit", "code-flow", "sound-wave", "map"]) {
    assert.ok(animated.includes(`"${visual}"`), `Missing visual renderer: ${visual}`);
  }
  assert.match(animated, /export function AnimatedVisual/);
  assert.match(animated, /Pause motion/);
  assert.match(animated, /Previous/);
  assert.match(animated, /Next scene/);
  assert.match(animated, /Replay lesson/);
  assert.match(animated, /disabled={!solved}/);
  assert.match(animated, /Good thinking/);
  assert.match(animated, /Solve this little discovery to unlock the next scene/);
  assert.match(animated, /useMemo\(\(\) => readMotionLesson\(content\), \[content\]\)/);
});

test("animated lesson controls and reduced-motion accessibility are present", () => {
  assert.match(animated, /setPaused/);
  assert.match(animated, /setIndex/);
  assert.match(styles, /\.motion-art\.paused/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(styles, /@keyframes motion-orbit-turn/);
  assert.match(styles, /@keyframes motion-plant-grow/);
  assert.match(styles, /\.motion-prediction-options/);
  assert.match(styles, /\.motion-feedback\.gentle/);
  assert.match(styles, /\.motion-data-track/);
  assert.match(styles, /\.motion-data-copy/);
  assert.match(styles, /\.motion-support-explanation/);
  assert.match(styles, /\.motion-learning-reflection/);
});


test("animated lessons include a friendly companion that celebrates discovery without reacting negatively to mistakes", () => {
  assert.match(animated, /motion-companion/);
  assert.match(animated, /A friendly little star companion/);
  assert.match(animated, /You did it!/);
  assert.match(animated, /Let's discover together!/);
  assert.match(animated, /We can try a new way!/);
  assert.match(styles, /@keyframes buddy-float/);
  assert.match(styles, /@keyframes buddy-celebrate/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
});

 
test("interactive Solar System explorer offers eight selectable worlds, facts, orbit times and accessible controls", () => {
  assert.match(studio, /function SpaceExplorer\(\)/);
  assert.match(studio, /const spaceWorlds = \[/);
  assert.match(studio, /role="group" aria-label="Choose a planet"/);
  assert.match(studio, /aria-pressed=\{selected === planet\.id\}/);
  assert.match(studio, /aria-live="polite"/);
  assert.match(studio, /<SpaceExplorer \/>/);
  for (const planet of ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"]) {
    assert.ok(studio.includes('name: "' + planet + '"'), "Missing Solar System destination: " + planet);
  }
  assert.match(studio, /not a scale model/);
  assert.match(styles, /\.space-planet-choice\.active/);
  assert.match(styles, /@keyframes space-sun-pulse/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
});


test("Solar System explorer includes an eight-planet mission, accessible progress, and supportive retry challenges", () => {
  assert.match(studio, /const \[visited, setVisited\] = useState\(\["earth"\]\)/);
  assert.match(studio, /const \[solved, setSolved\] = useState\(\[\]\)/);
  assert.match(studio, /SPACE EXPLORER MISSION/);
  assert.match(studio, /role="progressbar" aria-label="Planet discoveries completed"/);
  assert.match(studio, /stars earned/);
  assert.match(studio, /PLANET SIZE LAB/);
  assert.match(studio, /Compare its equatorial diameter with Earth/);
  assert.match(studio, /world\.sizeFactor/);
  assert.match(studio, /world\.diameter/);
  assert.match(studio, /DISCOVERY CHALLENGE/);
  assert.match(studio, /Good exploring—try another answer/);
  assert.match(studio, /Brilliant discovery! You earned a star/);
  assert.match(styles, /\.space-mission-progress/);
  assert.match(styles, /\.space-size-lab/);
  assert.match(styles, /\.space-mission-challenge/);
  for (const planet of ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"]) {
    assert.ok(studio.includes('name: "' + planet + '"'), "Missing mission world: " + planet);
  }
});

test("Learning Studio exposes a broad category-based catalogue and validates every catalogue subject on the server", async () => {
  const catalogPath = fileURLToPath(new URL("./learning-catalog.js", import.meta.url));
  const catalog = await import(new URL("./learning-catalog.js", import.meta.url));
  assert.ok(catalog.learningCategories.length >= 18);
  for (const category of ["Mathematics", "Natural sciences", "Engineering", "Computing & technology", "Languages & communication", "Humanities & social sciences", "Business & commerce", "Health & wellbeing education", "Agriculture & food systems", "Arts, design & creativity", "Competitive exams", "Vocational & professional skills", "Practical life skills", "Sports & games"]) {
    assert.ok(catalog.learningCategories.some((item) => item.name === category), "Missing category: " + category);
  }
  assert.ok(catalog.allLearningSubjects.includes("Physics"));
  assert.ok(catalog.allLearningSubjects.includes("Kannada"));
  assert.ok(catalog.allLearningSubjects.includes("Artificial intelligence"));
  assert.ok(catalog.allLearningSubjects.includes("UPSC foundation"));
  assert.ok(studio.includes("Learning category"));
  assert.ok(studio.includes("Choose a subject or topic"));
  assert.match(route, /const allowedLearningSubjects = allLearningSubjects/);
  assert.ok(catalogPath.endsWith("learning-catalog.js"));
});

test("learning universe presents every catalogue category as a selectable destination and supports expanded learner stages", () => {
  assert.match(studio, /function LearningCategoryExplorer/);
  assert.match(studio, /Explore every direction/);
  assert.match(studio, /onChooseCategory/);
  assert.match(studio, /learning-category-grid/);
  assert.match(studio, /early-years/);
  assert.match(studio, /postgraduate/);
  assert.match(studio, /professional/);
  assert.match(route, /"early-years", "primary", "middle", "secondary", "higher-secondary", "college", "postgraduate", "professional", "adult", "not-sure"/);
});


test("student mode includes an interactive 3D model lab rather than image-only learning", () => {
  const worldPath = fileURLToPath(new URL("../../app/learn/interactive-3d-world.jsx", import.meta.url));
  const world = readFileSync(worldPath, "utf8");
  assert.match(studio, /import Interactive3DWorld from ".\/interactive-3d-world"/);
  assert.match(studio, /<Interactive3DWorld \/>/);
  for (const model of ["planet", "molecule", "atom", "dna", "cube", "terrain", "cell", "solar-system", "plant-cell", "heart", "pyramid", "ecosystem", "engine", "cart"]) assert.ok(world.includes(`id: "${model}"`), `Missing 3D model: ${model}`);
  assert.match(world, /getContext\("2d"\)/);
  assert.match(world, /rotatePoint/);
  assert.match(world, /onPointerDown/);
  assert.match(world, /onWheel/);
  assert.match(world, /Zoom in/);
  assert.match(world, /Reset view/);
  assert.match(world, /modelExplorations/);
  assert.match(world, /DISCOVERY GUIDE/);
  assert.match(world, /Food web/);
  assert.match(world, /TRY A HABITAT EXPERIMENT/);
  assert.match(world, /rainfall: "regular"/);
  assert.match(world, /waterSource/);
  assert.match(world, /pollution/);
  assert.match(world, /Reset experiment/);
  assert.match(world, /qualitative teaching outcomes/);
  assert.match(world, /EXPLORE THE FOUR-STROKE CYCLE/);
  assert.match(world, /engineCycle/);
  for (const stage of ["intake", "compression", "power", "exhaust"]) assert.ok(world.includes(stage), `Missing engine cycle stage: ${stage}`);
  assert.match(world, /Restart cycle/);
  assert.match(world, /conceptual teaching model, not a timed or mechanically accurate engine simulation/);
  assert.match(world, /Force & motion cart/);
  assert.match(world, /TRY A FORCE & FRICTION EXPERIMENT/);
  assert.match(world, /physicsForce/);
  assert.match(world, /physicsFriction/);
  assert.match(world, /Balanced forces/);
  assert.match(world, /qualitative illustration, not a measured prediction/);
  assert.match(world, /Applied force/);
  assert.match(world, /Net force/);
  const miniModel = world.slice(world.indexOf("export function Mini3DModel"), world.indexOf("export default function Interactive3DWorld"));
  const mainLab = world.slice(world.indexOf("export default function Interactive3DWorld"));
  assert.doesNotMatch(miniModel, /drawScene\(canvas, modelId, rotation\.yaw, rotation\.pitch, zoom, ecosystem\)/);
  assert.match(mainLab, /drawScene\(canvas, modelId, rotation\.yaw, rotation\.pitch, zoom, ecosystem\)/);
  assert.match(mainLab, /\[modelId, rotation, zoom, ecosystem\]/);
  assert.match(world, /Connecting rod/);
  assert.match(world, /aria-live="polite"/);
  for (const concept of ["Equator & poles", "Molecular shape", "Atomic identity", "Base pairs", "Vertices", "Contour lines", "Mitochondria", "Planet groups", "Chloroplasts", "Body circuit", "History & engineering"]) {
    assert.ok(world.includes(concept), `Missing model-specific discovery concept: ${concept}`);
  }
  for (const modelId of ["planet", "molecule", "atom", "dna", "cube", "terrain", "cell", "solar-system", "plant-cell", "heart", "pyramid", "ecosystem", "engine"]) {
    assert.ok(world.includes(`${modelId}:`) || world.includes(`"${modelId}":`), `Missing guided exploration for ${modelId}`);
  }
  assert.match(world, /ArrowLeft/);
  assert.match(world, /role="application"/);
  assert.match(world, /not to scale/);
  assert.match(styles, /\.learning-3d-viewer canvas/);
  assert.match(styles, /touch-action:none/);
});

test("animated lesson schema and tutor prompts can select embedded interactive 3D scenes", () => {
  for (const visual of ["3d-planet", "3d-molecule", "3d-atom", "3d-dna", "3d-geometry", "3d-terrain", "3d-plant-cell", "3d-heart", "3d-pyramid", "3d-ecosystem", "3d-engine"]) {
    assert.ok(animated.includes(`"${visual}"`), `Animated lesson renderer missing ${visual}`);
    assert.ok(route.includes(visual), `Tutor prompt missing ${visual}`);
  }
  assert.match(animated, /Mini3DModel modelId={model3d}/);
  assert.match(route, /3D AND SPATIAL LEARNING/);
  assert.match(route, /interactive 3D lesson visuals/);
});
