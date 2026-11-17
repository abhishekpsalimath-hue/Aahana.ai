export const SCHOOL_JOURNEY = {
  version: 1,
  grades: [
    {
      id: "grade-1",
      label: "Grade 1",
      subjects: [
        { id: "mathematics", title: "Mathematics", status: "active" },
        { id: "english", title: "English", status: "locked" },
        { id: "environmental-studies", title: "Environmental Studies", status: "locked" },
        { id: "language-1", title: "First language", status: "locked" },
        { id: "language-2", title: "Second language", status: "locked" },
        { id: "creative-arts", title: "Art & creative activities", status: "locked" }
      ]
    },
    {
      id: "grade-2",
      label: "Grade 2",
      subjects: [
        { id: "mathematics", title: "Mathematics", status: "locked" },
        { id: "english", title: "English", status: "locked" },
        { id: "environmental-studies", title: "Environmental Studies", status: "locked" },
        { id: "language-1", title: "First language", status: "locked" },
        { id: "language-2", title: "Second language", status: "locked" },
        { id: "creative-arts", title: "Art & creative activities", status: "locked" }
      ]
    }
  ]
};

export const GRADE_1_MATH = {
  id: "grade-1-mathematics",
  title: "Grade 1 Mathematics",
  description: "A gentle, step-by-step journey through numbers, adding, shapes, patterns, measurement and data.",
  units: [
    {
      id: "counting-to-20",
      title: "Numbers all around us",
      objective: "Count, read, write and compare numbers from 0 to 20.",
      teach: [
        "Numbers help us tell how many things we can see.",
        "Count one object at a time. Say one number for each object.",
        "The number 0 means there are no objects. After 9 comes 10, then 11, 12 and so on up to 20.",
        "A number line helps us see order. Numbers farther to the right are greater."
      ],
      example: "There are 7 red blocks and 4 blue blocks. Seven comes before eleven, and 11 is greater than 7.",
      question: "Which number comes just after 14?",
      options: ["13", "15", "17"],
      answer: 1,
      explanation: "Counting forward from 14 gives 15. It is one more than 14.",
      practice: "Count 12 everyday objects. Point to each object once, then write the number 12."
    },
    {
      id: "addition-within-10",
      title: "Putting groups together",
      objective: "Add two groups and solve addition facts within 10.",
      teach: [
        "Addition means putting groups together to find how many there are altogether.",
        "The plus sign (+) tells us to add. The equals sign (=) shows that both sides have the same value.",
        "Start with 3 counters. Add 2 more counters. Count them all: 1, 2, 3, 4, 5.",
        "So 3 + 2 = 5. You can use fingers, dots, blocks or a number line."
      ],
      example: "A child has 4 mangoes and gets 3 more. 4 + 3 = 7 mangoes.",
      question: "What is 5 + 2?",
      options: ["6", "7", "8"],
      answer: 1,
      explanation: "Start at 5 and count two steps forward: 6, 7. So 5 + 2 = 7.",
      practice: "Draw 3 circles, then 4 more. Count all the circles and write the addition sentence."
    },
    {
      id: "subtraction-within-10",
      title: "Taking some away",
      objective: "Subtract by taking away and find how many remain.",
      teach: [
        "Subtraction means taking some away from a group or finding the difference.",
        "The minus sign (−) tells us to subtract.",
        "Begin with 6 objects. Take away 2. Count what is left: 1, 2, 3, 4.",
        "So 6 − 2 = 4. You can cross out pictures or count backwards."
      ],
      example: "There are 8 birds on a tree. 3 fly away. 8 − 3 = 5 birds remain.",
      question: "What is 9 − 4?",
      options: ["4", "5", "6"],
      answer: 1,
      explanation: "Count back four steps from 9: 8, 7, 6, 5. Five remain.",
      practice: "Draw 7 stars. Cross out 2 stars. Count the stars that are left."
    },
    {
      id: "shapes-and-space",
      title: "Shapes we can see",
      objective: "Recognise common 2D shapes and describe simple position words.",
      teach: [
        "A circle is round and has no corners.",
        "A triangle has 3 straight sides and 3 corners. A square has 4 equal sides and 4 corners.",
        "A rectangle has 4 sides. Opposite sides are equal in length.",
        "We can describe where things are using words such as above, below, beside, inside and outside."
      ],
      example: "A clock face is often a circle. A book cover is often a rectangle.",
      question: "Which shape has 3 sides?",
      options: ["Square", "Triangle", "Circle"],
      answer: 1,
      explanation: "A triangle has three straight sides and three corners.",
      practice: "Find one circle, one rectangle and one triangle in your home or classroom."
    },
    {
      id: "patterns-and-sorting",
      title: "Patterns and groups",
      objective: "Continue simple repeating patterns and sort objects by one feature.",
      teach: [
        "A pattern follows a rule that repeats or changes in a predictable way.",
        "Look at what repeats. In red, blue, red, blue, the two-colour rule repeats.",
        "Sorting means putting things into groups using a rule, such as colour, shape or size.",
        "A good sorting rule is clear: every object in a group follows that same rule."
      ],
      example: "Circle, square, circle, square, circle… The next shape is a square.",
      question: "What comes next: red, blue, red, blue, red, ...?",
      options: ["Red", "Blue", "Green"],
      answer: 1,
      explanation: "The pattern alternates red and blue, so blue comes next.",
      practice: "Make a repeating pattern using two colours of pencils or two kinds of objects."
    },
    {
      id: "measurement-and-data",
      title: "Measuring and noticing",
      objective: "Compare length, weight and capacity informally and read a simple picture count.",
      teach: [
        "We compare length using words such as longer and shorter.",
        "We compare weight using heavier and lighter. We compare capacity using holds more and holds less.",
        "Use the same kind of non-standard unit when comparing, such as the same paper clips or blocks.",
        "A simple picture graph uses pictures or marks to show how many are in each group. Count the marks to answer questions."
      ],
      example: "If 4 children choose apples and 2 choose bananas, apples were chosen by 2 more children.",
      question: "A ribbon is 8 blocks long. Another is 5 blocks long. Which is longer?",
      options: ["The 5-block ribbon", "The 8-block ribbon", "They are the same"],
      answer: 1,
      explanation: "Eight blocks is a greater length than five blocks, when measured with the same size blocks.",
      practice: "Measure two pencils using the same paper clips. Record which one is longer."
    }
  ],
  completionRule: "Complete each unit lesson and answer its check-for-understanding correctly. All six units must be completed to unlock the next Grade 1 subject."
};

export function getNextSchoolSubject(progress = {}) {
  for (const grade of SCHOOL_JOURNEY.grades) {
    for (const subject of grade.subjects) {
      const key = grade.id + ":" + subject.id;
      if (!progress[key]?.complete) return { gradeId: grade.id, gradeLabel: grade.label, subject, key };
    }
  }
  return null;
}

export function isGradeSubjectUnlocked(gradeId, subjectId, progress = {}) {
  let previous = true;
  for (const grade of SCHOOL_JOURNEY.grades) {
    for (const subject of grade.subjects) {
      if (grade.id === gradeId && subject.id === subjectId) return previous;
      previous = Boolean(progress[grade.id + ":" + subject.id]?.complete);
    }
  }
  return false;
}

export function getGradeOneMathProgress(progress = {}) {
  const record = progress["grade-1:mathematics"] || {};
  const completedUnits = GRADE_1_MATH.units.filter((unit) => record.units?.[unit.id]?.complete).length;
  return { completedUnits, totalUnits: GRADE_1_MATH.units.length, complete: completedUnits === GRADE_1_MATH.units.length };
}
