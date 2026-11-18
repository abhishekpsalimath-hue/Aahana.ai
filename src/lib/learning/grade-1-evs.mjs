/**
 * Grade 1 Environmental Studies discovery curriculum.
 * This is a board-neutral authored core, not a claim of syllabus equivalence.
 */
const makeUnit = (id, title, objective, teach, example, checks, activity, visual, interaction) => ({
  id, title, objective, teach, example, practice: activity,
  lessonDesign: {
    visual, interaction,
    scenes: [
      { title: "Look closely", focus: objective, activity: "Observe a familiar object, picture or safe everyday situation." },
      { title: "Connect the clues", focus: "Describe what the observation tells us.", activity: "Sort, label, compare or sequence the evidence." },
      { title: "Try it in real life", focus: "Use the idea in a new everyday example.", activity }
    ],
    safety: "Use observation and adult-guided demonstrations only. Never ask a child to taste unknown substances, handle dangerous animals, touch electrical equipment or approach traffic."
  },
  assessmentDesign: {
    warmUp: "Invite the learner to describe something they have noticed.",
    formativeChecks: checks,
    independentCheck: "Explain the idea using a new example from home or the classroom.",
    feedback: "Show a visual clue, explain the observation and invite another attempt without negative labels."
  }
});

export const GRADE_1_EVS_CURRICULUM = {
  id: "grade-1-evs",
  grade: 1,
  subject: "Environmental Studies",
  title: "Grade 1 Environmental Studies",
  version: 1,
  alignment: {
    status: "board-neutral-core",
    mappedBoards: [],
    note: "Observation-led foundational EVS core. Board-specific themes, textbook language and learning outcomes require a separate mapping review."
  },
  designPrinciples: [
    "Begin with the child's immediate surroundings and everyday experiences.",
    "Teach care, curiosity and observation rather than memorising disconnected facts.",
    "Use safe, inclusive examples from different homes, families and communities.",
    "Avoid assumptions that every learner has the same resources, family structure or environment."
  ],
  units: [
    makeUnit("living-and-nonliving", "Living and non-living things", "Notice simple differences between living things and non-living objects.", [
      "Living things need resources such as air, water or food and carry out life processes.",
      "Plants are living things even though they do not walk from place to place.",
      "A stone or a chair is non-living; it does not grow or carry out life processes.",
      "Look for several clues rather than deciding only because something moves."
    ], "A small plant grows and needs water. A toy car moves when pushed but is not alive.", [
      { question: "Which is a living thing?", options: ["A young plant", "A wooden table", "A ball"], answer: 0, explanation: "A plant grows and carries out life processes." },
      { question: "Which statement is true about a toy car?", options: ["It grows", "It is non-living", "It needs food"], answer: 1, explanation: "A toy car can move when pushed, but it is not alive." },
      { question: "Which is a useful clue for identifying a living thing?", options: ["It has a price", "It can grow", "It is always moving"], answer: 1, explanation: "Growth is one clue; movement alone is not enough." }
    ], "Draw one living thing and one non-living object. Tell how you know.", "living-things-sort", "sort-and-observe"),
    makeUnit("our-body-and-senses", "Our body and senses", "Name common body parts and describe how the senses help us notice the world.", [
      "Our eyes help us see, ears help us hear and the nose helps us smell.",
      "The tongue helps us taste, and the skin helps us feel touch.",
      "People may experience the world differently; some people use assistive tools or other senses.",
      "We care for our bodies with cleanliness, rest, safe movement and help from trusted adults."
    ], "We can hear a bell with our ears and feel a soft cloth with our skin.", [
      { question: "Which sense helps us hear music?", options: ["Hearing", "Smell", "Taste"], answer: 0, explanation: "Our ears help us hear sounds." },
      { question: "Which body part helps us notice texture by touch?", options: ["Skin", "Hair", "Teeth"], answer: 0, explanation: "The skin helps us feel textures." },
      { question: "What should you do if you feel unwell?", options: ["Hide it", "Tell a trusted adult", "Take unknown medicine"], answer: 1, explanation: "A trusted adult can help you get appropriate care." }
    ], "Make a five-senses observation chart using safe, familiar examples. Never taste unknown items.", "human-senses", "sense-match"),
    makeUnit("plants-and-animals", "Plants and animals around us", "Recognise common plants and animals and describe basic needs and respectful care.", [
      "Plants have parts such as roots, stems and leaves; different plants can look different.",
      "Animals need food, water and suitable places to live.",
      "Living things depend on their surroundings in different ways.",
      "Observe animals from a safe distance and never disturb nests or handle unfamiliar animals."
    ], "A tree provides shade and can be a home for birds and insects.", [
      { question: "Which part usually takes in water from the soil?", options: ["Root", "Flower", "Fruit"], answer: 0, explanation: "Roots take in water and help anchor many plants." },
      { question: "What do animals need?", options: ["Only toys", "Food, water and a suitable habitat", "Plastic objects"], answer: 1, explanation: "Animals need resources and a suitable place to live." },
      { question: "How should we observe an unfamiliar wild animal?", options: ["From a safe distance", "By catching it", "By feeding it unknown food"], answer: 0, explanation: "Watching from a safe distance protects both the child and animal." }
    ], "Observe a plant over several days and draw what changes. Do not pull it out.", "plant-growth-sequence", "label-plant-parts"),
    makeUnit("food-and-water", "Food and water", "Recognise that people need varied food and clean water, and describe simple ways to reduce waste.", [
      "Food gives our bodies energy and materials for growth and repair.",
      "Different foods provide different nutrients, so variety matters.",
      "Water is important for the body. Use safe drinking water.",
      "Store food safely, wash hands before eating and avoid wasting food and water."
    ], "A meal can include different foods such as grains, vegetables, fruit and protein-rich foods.", [
      { question: "Why do we need food?", options: ["For energy and growth", "To change our height instantly", "Only for decoration"], answer: 0, explanation: "Food supplies energy and nutrients the body uses." },
      { question: "Which is a safe habit before eating?", options: ["Wash hands", "Touch every food item on display", "Drink from an unknown bottle"], answer: 0, explanation: "Washing hands helps reduce the spread of germs." },
      { question: "Which action helps save water?", options: ["Leave the tap running", "Turn off the tap when not using it", "Pour clean water away for fun"], answer: 1, explanation: "Turning off an unused tap avoids unnecessary waste." }
    ], "Plan a colourful meal with foods available in your home and identify one way to avoid waste.", "food-groups", "meal-builder"),
    makeUnit("home-school-community", "Home, school and community", "Describe different places people use and recognise helpful roles in a community.", [
      "People live in different kinds of homes suited to their needs and surroundings.",
      "Schools and community places help people learn, meet and access services.",
      "Many people contribute to a community through different kinds of work.",
      "Families and communities can look different; respect and kindness matter."
    ], "A nurse, bus driver, farmer, shop worker and teacher can all contribute to community life.", [
      { question: "Which place is commonly used for learning together?", options: ["School", "River", "Road crossing"], answer: 0, explanation: "A school is a place where learners and teachers meet." },
      { question: "Who can help care for a sick person?", options: ["A healthcare worker", "A traffic signal", "A bookshelf"], answer: 0, explanation: "Healthcare workers help people with health needs." },
      { question: "How should we treat people whose homes or families are different from ours?", options: ["With respect", "By making fun of them", "By excluding them"], answer: 0, explanation: "People and families are diverse and deserve respect." }
    ], "Draw a simple map of places you know and describe how people use them.", "community-map", "place-and-role-match"),
    makeUnit("weather-and-care", "Weather, seasons and caring for our surroundings", "Observe everyday weather and identify simple actions that keep people and places safer.", [
      "Weather can be sunny, cloudy, rainy or windy, and it can change.",
      "People choose clothing and activities that suit the weather.",
      "Clean surroundings, careful waste disposal and saving resources help our environment.",
      "Follow trusted adult guidance during storms, extreme heat, floods or other hazards."
    ], "An umbrella can help keep us dry in rain, while shade can help protect us from strong sun.", [
      { question: "What might you use in rainy weather?", options: ["An umbrella", "A paper fan only", "Sunglasses underwater"], answer: 0, explanation: "An umbrella can help keep rain off." },
      { question: "Which action helps keep a shared place clean?", options: ["Put waste in the correct bin", "Drop litter", "Pour paint into a drain"], answer: 0, explanation: "Using the right waste bin helps keep places cleaner." },
      { question: "What should a child do during dangerous weather?", options: ["Follow a trusted adult's safety guidance", "Go outside alone", "Ignore warnings"], answer: 0, explanation: "Trusted adults and local safety guidance help children stay safe." }
    ], "Keep a simple weather diary for one week and suggest one way to care for your surroundings.", "weather-wheel", "weather-observation")
  ],
  qualityGate: [
    "Scientific statements reviewed for age-appropriate accuracy",
    "Examples are inclusive of different families, homes and communities",
    "Activities avoid unsafe handling, tasting or unsupervised experiments",
    "Observation tasks work with low-cost everyday materials",
    "Board-specific EVS alignment reviewed before making official syllabus claims"
  ]
};
