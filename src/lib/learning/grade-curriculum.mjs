import { GRADE_1_MATH } from "./school-journey.mjs";
import { GRADE_1_ENGLISH_CURRICULUM } from "./grade-1-english.mjs";
import { GRADE_1_EVS_CURRICULUM } from "./grade-1-evs.mjs";

/**
 * Grade-level lesson content is an authoring asset, not a student lock system.
 * Board alignment stays explicitly unclaimed until a board-specific review maps
 * every outcome to the current official syllabus.
 */
const lessonDesign = {
  "counting-to-20": {
    visual: "counter-board",
    interaction: "count-and-place",
    visualBrief: "A responsive number line from 0 to 20 with draggable counters, one-to-one object counting and a clear zero state.",
    scenes: [
      { title: "Numbers are everywhere", focus: "Connect number words to real groups of objects.", activity: "Count a small group of familiar objects, touching or highlighting each object once." },
      { title: "Build the number line", focus: "Show that each next position is one more.", activity: "Move a marker from 0 to 20 and say the next number at each step." },
      { title: "Compare two groups", focus: "Compare quantities using more, fewer and equal.", activity: "Build two groups and compare their counts before revealing the numerals." }
    ],
    misconceptions: ["Counting an object twice or skipping an object", "Treating zero as if it means one", "Comparing numerals by appearance rather than quantity"],
    extension: "Make two different groups that have the same number of objects."
  },
  "addition-within-10": {
    visual: "counter-board",
    interaction: "combine-counters",
    visualBrief: "Two colourful counter groups combine into one total; a number-line jump animation shows addition as moving forward.",
    scenes: [
      { title: "Two groups meet", focus: "Addition combines quantities into a total.", activity: "Place one group of counters beside another and count the whole group." },
      { title: "Jump forward", focus: "Addition can be represented as forward movement.", activity: "Start at the first addend and make one jump for each counter in the second addend." },
      { title: "Write the number sentence", focus: "Connect the objects, spoken explanation and symbols.", activity: "Match the counter model to an addition sentence using + and =." }
    ],
    misconceptions: ["Counting the first group again after counting it once", "Confusing the plus sign with the equals sign", "Assuming the order of groups changes the total"],
    extension: "Find two different pairs of numbers that make 10."
  },
  "subtraction-within-10": {
    visual: "counter-board",
    interaction: "remove-counters",
    visualBrief: "A group of counters visibly moves away while the remaining objects stay highlighted; a number-line marker jumps backwards.",
    scenes: [
      { title: "A group gets smaller", focus: "Subtraction can describe taking away.", activity: "Build a group, remove a chosen number of counters and count what remains." },
      { title: "Jump backwards", focus: "Represent subtraction as backward movement.", activity: "Start at the first number and move back one step for each object removed." },
      { title: "Explain what remains", focus: "Connect the action to the minus sign and answer.", activity: "Choose the matching subtraction sentence and explain what each number represents." }
    ],
    misconceptions: ["Removing the wrong number of objects", "Counting the removed objects as if they remain", "Mixing up the starting amount and the amount taken away"],
    extension: "Show two different ways to take away 5 and reach the same answer."
  },
  "shapes-and-space": {
    visual: "3d-geometry",
    interaction: "shape-explorer",
    visualBrief: "Large, rotatable 2D shape cards and familiar 3D objects with clearly counted sides, corners and curved boundaries.",
    scenes: [
      { title: "Find shapes around you", focus: "Recognise circles, triangles, squares and rectangles.", activity: "Match everyday objects to their shape outlines." },
      { title: "Look closely", focus: "Describe sides and corners without relying on colour.", activity: "Trace each boundary and count its straight sides and corners." },
      { title: "Where is it?", focus: "Use simple spatial language.", activity: "Move an object above, below, beside, inside or outside another object." }
    ],
    misconceptions: ["Identifying a shape only by its orientation", "Calling a circle a shape with one straight side", "Assuming every four-sided shape is a square"],
    extension: "Find an object that combines more than one shape."
  },
  "patterns-and-sorting": {
    visual: "concept-map",
    interaction: "pattern-builder",
    visualBrief: "A colourful pattern-building strip with movable shapes and objects; learners choose the repeating rule and extend it.",
    scenes: [
      { title: "Spot what repeats", focus: "Notice the smallest repeating part of a pattern.", activity: "Highlight the repeating unit in a simple AB or AAB pattern." },
      { title: "Continue the pattern", focus: "Use the rule to predict what comes next.", activity: "Choose and place the next item, then explain the rule." },
      { title: "Sort with a rule", focus: "Group objects by one clear feature.", activity: "Sort mixed objects by colour, shape or size and name the rule." }
    ],
    misconceptions: ["Guessing the next item without identifying the rule", "Changing the sorting rule halfway through", "Assuming objects can only be sorted in one way"],
    extension: "Create a pattern that a friend can continue and explain its rule."
  },
  "measurement-and-data": {
    visual: "bar-chart",
    interaction: "measure-and-compare",
    visualBrief: "An interactive balance, capacity comparison and picture graph; use identical informal units and make each count visible.",
    scenes: [
      { title: "Compare lengths", focus: "Use the same informal unit to compare lengths fairly.", activity: "Measure two objects with identical blocks or paper clips." },
      { title: "Compare weight and capacity", focus: "Use heavier, lighter, holds more and holds less accurately.", activity: "Compare safe everyday objects and containers through observation." },
      { title: "Read a picture graph", focus: "Count symbols and compare categories.", activity: "Build a small class-preference picture graph and answer how many and how many more." }
    ],
    misconceptions: ["Using different-sized units in one comparison", "Confusing a larger container with a heavier object", "Counting graph labels instead of the data symbols"],
    extension: "Collect a small set of class or family preferences and display the counts."
  }
};

export const GRADE_1_MATHEMATICS_CURRICULUM = {
  id: "grade-1-mathematics",
  grade: 1,
  subject: "Mathematics",
  title: "Grade 1 Mathematics",
  version: 2,
  alignment: {
    status: "board-neutral-core",
    mappedBoards: [],
    note: "Core learning content only. CBSE, ICSE, Karnataka State Board and other board mappings require a separate syllabus-by-syllabus review."
  },
  designPrinciples: [
    "Move from concrete objects to pictures, spoken reasoning and mathematical symbols.",
    "Keep activities short, tactile, visual and usable on small screens.",
    "Give a helpful hint and a fresh example after an incorrect response; never shame or block exploration.",
    "Check understanding through explanation and application, not only memorised answers."
  ],
  units: GRADE_1_MATH.units.map((unit, index) => ({
    ...unit,
    sequence: index + 1,
    lessonDesign: lessonDesign[unit.id],
    assessmentDesign: {
      warmUp: "Begin with a low-pressure prediction or observation.",
      formativeChecks: unit.checks,
      independentCheck: unit.question,
      feedback: "Explain the idea, show the visual model and offer another attempt with a new example.",
      mastery: "Look for consistent understanding across the worked example, three checks and a new everyday application."
    }
  })),
  qualityGate: [
    "Mathematical accuracy reviewed",
    "Reading level and age suitability reviewed",
    "Visual model matches the mathematical idea",
    "Keyboard and touch interaction tested",
    "Reduced-motion and screen-reader alternatives provided",
    "Board alignment reviewed before any board-specific claim"
  ]
};

export function getGradeLearningCurriculum(grade, subject) {
  if (Number(grade) !== 1) return null;
  const normalizedSubject = String(subject).trim().toLowerCase();
  if (["mathematics", "maths", "math", "arithmetic", "maths practice", "number systems", "mathematical reasoning"].includes(normalizedSubject)) return GRADE_1_MATHEMATICS_CURRICULUM;
  if (normalizedSubject === "english") return GRADE_1_ENGLISH_CURRICULUM;
  if (["evs", "environmental studies", "environmental science"].includes(normalizedSubject)) return GRADE_1_EVS_CURRICULUM;
  return null;
}

export function getGradeCurriculumCoverage() {
  return {
    authored: GRADE_1_MATHEMATICS_CURRICULUM.units.length + GRADE_1_ENGLISH_CURRICULUM.units.length + GRADE_1_EVS_CURRICULUM.units.length,
    subjects: 3,
    units: { mathematics: GRADE_1_MATHEMATICS_CURRICULUM.units.length, english: GRADE_1_ENGLISH_CURRICULUM.units.length, evs: GRADE_1_EVS_CURRICULUM.units.length },
    lessonDesigns: GRADE_1_MATHEMATICS_CURRICULUM.units.filter((unit) => unit.lessonDesign).length + GRADE_1_ENGLISH_CURRICULUM.units.filter((unit) => unit.lessonDesign).length + GRADE_1_EVS_CURRICULUM.units.filter((unit) => unit.lessonDesign).length,
    assessmentDesigns: GRADE_1_MATHEMATICS_CURRICULUM.units.filter((unit) => unit.assessmentDesign).length + GRADE_1_ENGLISH_CURRICULUM.units.filter((unit) => unit.assessmentDesign).length + GRADE_1_EVS_CURRICULUM.units.filter((unit) => unit.assessmentDesign).length,
    boardMapped: false
  };
}
