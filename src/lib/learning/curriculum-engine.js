import { learningSubjectIndex } from "./learning-catalog.js";

/**
 * Authored curriculum metadata is separate from subject discovery.
 * Searchable does not mean a complete lesson is available.
 */
export const learningCurricula = [
  {
    subjectId: "nature-planet-exploration-solar-system",
    version: 1,
    title: "Our Solar System",
    suggestedLevels: ["primary", "middle", "secondary"],
    prerequisites: [],
    learningOutcomes: [
      "Identify the Sun and the eight planets in order from the Sun",
      "Compare broad characteristics of the inner and outer planets",
      "Explain the difference between a planet's rotation and revolution",
      "Interpret why simplified diagrams may not show orbital distances and planet sizes to scale"
    ],
    units: [
      {
        id: "solar-neighbourhood",
        title: "Meet our solar neighbourhood",
        outcomes: ["Describe the Sun's role in the Solar System", "Distinguish planets from moons and smaller bodies"],
        concepts: ["Sun", "planet", "moon", "dwarf planet", "orbit"]
      },
      {
        id: "inner-worlds",
        title: "The four inner planets",
        outcomes: ["Name Mercury, Venus, Earth and Mars in order", "Compare their rocky surfaces and atmospheres"],
        concepts: ["terrestrial planets", "surface", "atmosphere", "temperature"]
      },
      {
        id: "giant-worlds",
        title: "The giant planets",
        outcomes: ["Name Jupiter, Saturn, Uranus and Neptune in order", "Compare gas giants and ice giants"],
        concepts: ["gas giant", "ice giant", "rings", "moons"]
      },
      {
        id: "motion-and-scale",
        title: "Motion, distance and scale",
        outcomes: ["Explain rotation and revolution", "Read orbital periods as comparisons", "Recognise the limits of a not-to-scale model"],
        concepts: ["rotation", "revolution", "orbital period", "astronomical unit", "scale model"]
      }
    ],
    assessment: {
      methods: ["planet-ordering", "visual-identification", "concept-comparison", "explain-in-your-own-words"],
      masteryRule: "Check each learning outcome independently; do not infer mastery from time spent or a single quiz score."
    },
    visualRequirements: [
      "Allow selection and close-up inspection of all eight planets",
      "Keep the selected planet consistent in the selector and 3D scene",
      "Label distances and sizes as illustrative whenever the scene is not to scale",
      "Use planet-specific surface features only when supported by reliable scientific references"
    ],
    curriculumStatus: "authored",
    lessonStatus: "review-required"
  }
];

const curriculumBySubjectId = new Map(learningCurricula.map((item) => [item.subjectId, item]));

export function getLearningCurriculum(subjectId) {
  return curriculumBySubjectId.get(subjectId) || null;
}

export function getLearningReadiness(subjectId) {
  const subject = learningSubjectIndex.find((item) => item.id === subjectId);
  if (!subject) {
    return { subjectId, discovery: "unknown", curriculum: "not-authored", lesson: "not-authored" };
  }

  const curriculum = getLearningCurriculum(subjectId);
  return {
    subjectId,
    discovery: "available",
    curriculum: curriculum?.curriculumStatus || "not-authored",
    lesson: curriculum?.lessonStatus || "not-authored",
    curriculumVersion: curriculum?.version ?? null
  };
}
