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
  assert.match(studio, /What are you exploring\?/);
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
  assert.match(route, /visual \(exactly one of fraction, orbit, water-cycle, plant-growth, number-line, molecule, concept-map\)/);
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
  for (const visual of ["fraction", "orbit", "water-cycle", "plant-growth", "number-line", "molecule", "concept-map"]) {
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
