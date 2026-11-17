import { learningSubjectIndex, learningCategories } from "./learning-catalog.js";

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


/**
 * First cross-catalogue authored curriculum tranche.
 * Each entry is subject-specific: outcomes, sequenced units, concepts and
 * assessment methods are deliberately authored rather than inferred from search.
 */
const authoredSubjectSeeds = [
  ["Explore anything","Critical thinking","Thinking clearly and testing ideas",
    ["Separate a claim from the evidence offered for it","Compare explanations using relevance and reliability","Recognise assumptions and revise a conclusion when evidence changes"],
    [["Claims, reasons and evidence",["Identify a claim, its supporting reason and the evidence offered"],["claim","reason","evidence","example"]],["Compare explanations",["Judge whether evidence is relevant, sufficient and trustworthy"],["relevance","reliability","corroboration","bias"]],["Reach a careful conclusion",["State a proportionate conclusion and explain what could change it"],["assumption","counterexample","uncertainty","revision"]]],
    ["claim-evidence analysis","source comparison","reasoned written conclusion"]],
  ["Mathematics","Algebra","Algebra: expressions, equations and patterns",
    ["Translate a verbal relationship into an algebraic expression","Simplify expressions while preserving equality","Solve and check one-variable linear equations"],
    [["Variables and expressions",["Distinguish a variable, coefficient, constant and term","Translate simple word statements into expressions"],["variable","coefficient","constant","term"]],["Equivalent expressions",["Use the distributive property and collect like terms","Explain why two expressions are equivalent"],["like terms","distributive property","simplification"]],["Equations as balance",["Solve a one-variable linear equation using inverse operations","Substitute a solution to verify it"],["equation","inverse operation","solution","verification"]]],
    ["expression translation","worked-equation analysis","solve-and-substitute check"]],
  ["Natural sciences","Biology","Biology: cells, systems and living processes",
    ["Identify shared features of cells and distinguish major cell structures","Explain how specialised cells support organism functions","Connect a biological process to evidence at more than one scale"],
    [["Cells as living units",["Describe the cell as a basic unit of life","Compare common features of plant and animal cells"],["cell membrane","cytoplasm","nucleus","organelle"]],["Structure supports function",["Relate selected cell structures to their roles","Explain why specialised cells have different forms"],["specialisation","tissue","organ","function"]],["From cells to organisms",["Trace a simple example from cell to tissue to organ system","Use observations or a labelled model to support an explanation"],["organisation","system","evidence","model"]]],
    ["labelled-cell interpretation","structure-function explanation","scale-sequencing task"]],
  ["Engineering","Robotics","Robotics: sensing, decisions and movement",
    ["Distinguish sensors, controllers and actuators in a robot","Describe a simple sense-decide-act control loop","Predict how a change in input affects robot behaviour"],
    [["Robot building blocks",["Classify examples as sensors, controller or actuators","Trace how information and energy move through a robot"],["sensor","controller","actuator","power"]],["Sense and decide",["Explain how sensor readings become control decisions","Represent a simple decision with a flowchart"],["input","threshold","condition","algorithm"]],["Movement and testing",["Relate motor output to a robot's movement","Plan a repeatable test and use results to improve behaviour"],["motor","feedback","iteration","test"]]],
    ["component classification","control-flow tracing","test-plan evaluation"]],
  ["Computing & technology","Programming","Programming foundations: logic, data and debugging",
    ["Describe how an algorithm becomes executable instructions","Use sequence, selection and repetition to express a solution","Trace a small program and locate a logical error"],
    [["Algorithms before code",["Write an unambiguous step-by-step algorithm","Identify inputs, outputs and edge cases"],["algorithm","input","output","sequence"]],["Control the flow",["Use conditions to choose between paths","Use repetition when a task contains a repeated action"],["selection","condition","loop","iteration"]],["Trace and debug",["Trace variable values through a short program","Use a test case to isolate and correct a defect"],["variable","trace table","debugging","test case"]]],
    ["algorithm design","code tracing","debugging with test cases"]],
  ["Languages & communication","English","English communication: reading, writing and speaking",
    ["Identify a text's purpose, audience and central idea","Build a coherent paragraph with relevant supporting detail","Adapt spoken language for clarity and audience"],
    [["Read for meaning",["Distinguish a central idea from supporting details","Use context to infer the meaning of unfamiliar words"],["purpose","audience","main idea","inference"]],["Write a clear paragraph",["Create a focused topic sentence","Arrange supporting details in a logical order"],["topic sentence","cohesion","evidence","editing"]],["Speak to be understood",["Organise a short explanation with a clear opening and close","Use pace, emphasis and listening to support communication"],["structure","pace","emphasis","active listening"]]],
    ["reading annotation","paragraph revision","short spoken explanation"]],
  ["Humanities & social sciences","History","History: evidence, chronology and interpretation",
    ["Place events in chronological context without confusing sequence with cause","Distinguish primary and secondary historical sources","Compare interpretations using evidence and context"],
    [["Time and context",["Read a timeline and distinguish dates, periods and duration","Explain why historical context matters"],["chronology","periodisation","context","continuity"]],["Working with sources",["Identify who created a source, when and for what purpose","Separate what a source states from what it can prove"],["primary source","secondary source","provenance","perspective"]],["Build an interpretation",["Corroborate claims across more than one source","Write a supported explanation that acknowledges uncertainty"],["corroboration","causation","interpretation","uncertainty"]]],
    ["timeline interpretation","source provenance analysis","evidence-backed historical explanation"]],
  ["Business & commerce","Entrepreneurship","Entrepreneurship: problem, customer and viable offer",
    ["Describe a customer problem without assuming the solution","Identify a target user and testable value proposition","Estimate basic costs, price and revenue for a small offer"],
    [["Find a real problem",["Distinguish a symptom from an underlying customer problem","Write a focused problem statement"],["customer","need","pain point","problem statement"]],["Test the value proposition",["Describe the target user and the benefit offered","Design a low-cost interview or prototype test"],["segment","value proposition","prototype","validation"]],["Understand viability",["Separate fixed and variable costs","Calculate a simple contribution and identify assumptions"],["fixed cost","variable cost","price","revenue"]]],
    ["problem-statement critique","customer-test design","basic unit-economics calculation"]],
  ["Health & wellbeing education","Nutrition","Nutrition: food, nutrients and balanced choices",
    ["Distinguish macronutrients from micronutrients","Explain how dietary patterns support body functions","Interpret food information without treating one food as a complete health measure"],
    [["Nutrients and roles",["Classify carbohydrates, proteins and fats as macronutrients","Describe the roles of vitamins, minerals and water"],["carbohydrate","protein","fat","micronutrient"]],["Build a balanced pattern",["Explain why variety and proportion matter across meals","Relate fibre and hydration to normal body functions"],["dietary variety","fibre","hydration","balance"]],["Read food information",["Interpret serving size and nutrient quantities on a label","Compare products using like-for-like portions"],["serving size","label","portion","comparison"]]],
    ["nutrient-role matching","meal-pattern analysis","food-label comparison"]],
  ["Agriculture & food systems","Soil science","Soil science: formation, texture and fertility",
    ["Describe how parent material, climate and organisms contribute to soil formation","Compare soil textures using particle proportions and drainage","Explain how organic matter and careful management support soil health"],
    [["How soil forms",["Identify major factors involved in soil formation","Distinguish soil horizons in a simple profile"],["parent material","weathering","horizon","organic matter"]],["Texture and water",["Compare sand, silt and clay by particle size","Predict how texture influences drainage and water retention"],["sand","silt","clay","permeability"]],["Fertility and stewardship",["Explain roles of organic matter and nutrients","Choose a soil-conservation practice for a stated situation"],["fertility","nutrient","compost","erosion"]]],
    ["soil-profile labelling","texture and drainage prediction","conservation case analysis"]],
  ["Arts, design & creativity","Drawing","Drawing foundations: observation, shape and value",
    ["Break a complex subject into observable basic shapes","Use proportion and negative space to improve a drawing","Create a value range to communicate form and light"],
    [["Observe and simplify",["Identify major shapes and directional lines","Draw from observation rather than relying only on symbols"],["observation","gesture","basic shape","contour"]],["Proportion and space",["Compare relative heights, widths and angles","Use negative space to check relationships"],["proportion","alignment","negative space","composition"]],["Light and form",["Build a value scale from light to dark","Use highlights, midtones and shadows to suggest volume"],["value","light source","cast shadow","form"]]],
    ["shape-blocking exercise","proportion check","value-study critique"]],
  ["Literature & media","Poetry","Poetry: image, sound and interpretation",
    ["Distinguish speaker from author and identify a poem's situation","Explain how imagery and sound shape meaning","Support an interpretation with specific textual evidence"],
    [["Voice and situation",["Identify the speaker, setting and situation","Summarise a poem without replacing its language with assumptions"],["speaker","tone","situation","context"]],["Imagery and sound",["Interpret a metaphor or simile in context","Describe how rhythm, repetition or sound affects a line"],["imagery","metaphor","simile","rhythm"]],["Interpret with evidence",["Develop a reading supported by precise words or lines","Compare two plausible interpretations respectfully"],["close reading","evidence","ambiguity","interpretation"]]],
    ["speaker-and-tone annotation","imagery analysis","evidence-supported interpretation"]],
  ["Law, society & citizenship","Constitution of India","Constitution of India: structure, rights and institutions",
    ["Explain the Constitution's role as the foundational legal framework","Distinguish Fundamental Rights from Directive Principles at a basic level","Describe the broad roles of the legislature, executive and judiciary"],
    [["Constitutional foundations",["Explain why a constitution defines powers and limits","Identify the Preamble's broad constitutional values"],["constitution","Preamble","sovereignty","rule of law"]],["Rights and principles",["Describe the purpose of Fundamental Rights","Distinguish enforceable rights from Directive Principles in broad terms"],["Fundamental Rights","Directive Principles","duties","equality"]],["Institutions and checks",["Describe the broad functions of Parliament, government and courts","Explain why separation of powers and accountability matter"],["legislature","executive","judiciary","accountability"]]],
    ["constitutional-term matching","rights-versus-principles comparison","institution-role scenario"]],
  ["School learning","Study skills","Study skills: planning, retrieval and reflection",
    ["Break a learning goal into manageable study sessions","Use retrieval practice to check understanding","Reflect on errors and adjust a study strategy"],
    [["Plan a learning session",["Turn a broad goal into a specific task","Estimate time and include a realistic break"],["goal","task breakdown","schedule","focus"]],["Remember through retrieval",["Recall ideas before rereading notes","Use spaced review to revisit material over time"],["retrieval practice","spacing","self-testing","memory"]],["Learn from feedback",["Classify an error as a knowledge or process gap","Choose a next step based on evidence from practice"],["feedback","error analysis","reflection","adjustment"]]],
    ["study-plan review","closed-book recall","error-analysis reflection"]],
  ["Competitive exams","UPSC foundation","UPSC foundation: institutions, polity and current-affairs reasoning",
    ["Explain core constitutional institutions and their roles","Distinguish a factual claim from an opinion in a news item","Connect a current issue to relevant background concepts without speculation"],
    [["Polity foundations",["Describe the broad roles of Parliament, executive and judiciary","Identify constitutional principles relevant to public institutions"],["polity","institution","federalism","accountability"]],["Read current affairs critically",["Identify the who, what, when and source of a report","Separate reported facts, analysis and unverified claims"],["source","fact","analysis","verification"]],["Build an exam-ready answer",["Organise an answer around a clear demand and relevant evidence","Avoid unsupported generalisations and irrelevant detail"],["question demand","structure","evidence","precision"]]],
    ["institution mapping","news-source evaluation","structured short-answer practice"]],
  ["Vocational & professional skills","Excel and spreadsheets","Spreadsheet skills: clean data, formulas and analysis",
    ["Organise tabular data with consistent fields and formats","Use basic formulas and relative or absolute references appropriately","Summarise data with filters, sorting and a simple chart"],
    [["Structure reliable data",["Use one record per row and clear field headings","Recognise blanks, duplicates and inconsistent formats"],["table","record","field","data quality"]],["Calculate with formulas",["Use SUM, AVERAGE, COUNT and simple conditional logic","Explain how relative and absolute references behave when copied"],["formula","function","relative reference","absolute reference"]],["Explore and communicate",["Sort and filter records without losing row relationships","Choose a chart that matches the comparison being made"],["sort","filter","chart","interpretation"]]],
    ["data-cleaning exercise","formula-tracing task","chart-selection explanation"]],
  ["Practical life skills","Cooking","Cooking foundations: preparation, heat and kitchen safety",
    ["Prepare a simple cooking workflow before starting","Explain how common heat methods change food","Apply practical hygiene and cross-contamination precautions"],
    [["Prepare the workspace",["Read a recipe and sequence preparation steps","Identify tools and ingredients before heating begins"],["mise en place","recipe","equipment","sequence"]],["Heat and transformation",["Distinguish boiling, steaming, sautéing and baking","Relate time, temperature and food size to cooking results"],["heat transfer","moisture","temperature","texture"]],["Safety and hygiene",["Separate raw and ready-to-eat foods","Explain handwashing, safe storage and careful handling of hot equipment"],["cross-contamination","hygiene","storage","burn prevention"]]],
    ["workflow sequencing","cooking-method comparison","kitchen-safety scenario"]],
  ["Nature, planet & exploration","Wildlife","Wildlife: habitats, adaptations and conservation",
    ["Describe how habitat conditions support a species' needs","Relate an observable adaptation to survival or reproduction","Compare conservation actions at local and ecosystem scales"],
    [["Habitats and niches",["Identify food, water, shelter and space needs","Distinguish a habitat from an ecological niche"],["habitat","niche","resource","ecosystem"]],["Adaptation and evidence",["Describe structural, behavioural and physiological adaptations","Avoid assuming that every trait is an adaptation without evidence"],["adaptation","selection","behaviour","evidence"]],["Conservation choices",["Identify pressures such as habitat loss and invasive species","Compare practical conservation responses and trade-offs"],["biodiversity","habitat loss","invasive species","conservation"]]],
    ["habitat-needs mapping","adaptation-evidence explanation","conservation case comparison"]],
  ["Sports & games","Chess","Chess foundations: board, pieces and tactical awareness",
    ["Set up the board with correct orientation and starting positions","Describe legal movement and capture for each piece","Recognise basic threats and protect the king"],
    [["Board and setup",["Orient the board with a light square at each player's right","Place pieces in the standard starting arrangement"],["files","ranks","squares","setup"]],["Movement and special rules",["Describe how each piece moves and captures","Recognise check, checkmate and stalemate at a basic level"],["piece movement","capture","check","checkmate"]],["Think one move ahead",["Identify an undefended piece and a direct threat","Compare candidate moves for king safety and material"],["threat","defence","material","candidate move"]]],
    ["board-setup check","legal-move classification","one-move tactical puzzle"]],
  ["Global systems & world affairs","Geopolitics","Geopolitics: geography, power and interdependence",
    ["Explain how location and resources can shape state interests","Distinguish a geopolitical fact from an interpretation or prediction","Map how trade, security and diplomacy create interdependence"],
    [["Geography and strategic context",["Relate location, terrain and access routes to strategic interests","Avoid treating geography as the sole cause of political decisions"],["location","chokepoint","resources","strategic interest"]],["Power and evidence",["Distinguish material capabilities from influence and legitimacy","Check claims against multiple credible sources"],["capability","influence","legitimacy","evidence"]],["Interdependence and diplomacy",["Trace a simple trade or security relationship between actors","Identify cooperation, competition and possible shared interests"],["interdependence","trade","diplomacy","cooperation"]]],
    ["map-based case reading","claim-evidence evaluation","actor-relationship mapping"]],
  ["Cultures & civilisations","Ancient civilisations","Ancient civilisations: cities, exchange and evidence",
    ["Describe features used to study an ancient civilisation","Interpret archaeological evidence with attention to context","Compare civilisations without assuming they followed identical paths"],
    [["How historians study the past",["Distinguish archaeological remains from later written accounts","Explain why context and dating affect interpretation"],["archaeology","artefact","stratigraphy","dating"]],["Cities and exchange",["Identify roles of settlement, agriculture, craft and trade","Use material evidence to infer connections cautiously"],["settlement","surplus","trade","urbanisation"]],["Compare responsibly",["Compare two societies using defined criteria","Recognise gaps and uncertainty in surviving evidence"],["comparison","continuity","change","evidence gap"]]],
    ["evidence classification","trade-network interpretation","criteria-based comparison"]],
  ["Earth systems & sustainability","Climate systems","Climate change: evidence, impacts and responses",
    ["Distinguish weather variability from long-term climate trends","Explain the enhanced greenhouse effect using energy flow","Compare mitigation and adaptation responses with their trade-offs"],
    [["Weather and climate evidence",["Explain the difference between daily weather and climate statistics","Interpret a trend while recognising variability and uncertainty"],["weather","climate","trend","baseline"]],["Greenhouse effect",["Describe how greenhouse gases absorb and re-emit infrared energy","Distinguish the natural greenhouse effect from its human-driven enhancement"],["infrared","greenhouse gas","energy balance","emissions"]],["Responses and choices",["Classify an action as mitigation, adaptation or both","Compare responses by effectiveness, equity and feasibility"],["mitigation","adaptation","resilience","equity"]]],
    ["weather-climate classification","energy-flow explanation","response trade-off analysis"]],
  ["Research & advanced learning","Scientific method","Scientific method: questions, hypotheses and evidence",
    ["Turn an observation into a focused, testable research question","Identify variables and design a fair comparison","Interpret results while distinguishing evidence from conclusion"],
    [["Ask a testable question",["Define the population or system being studied","Write a question that can be investigated with observable evidence"],["observation","research question","scope","testability"]],["Design a fair test",["Identify independent, dependent and controlled variables","Choose measurements and repeats that reduce avoidable error"],["variable","control","measurement","replication"]],["Interpret and communicate",["Describe patterns without overstating causation","State limitations and a conclusion proportionate to the data"],["result","uncertainty","limitation","conclusion"]]],
    ["question-quality review","variable-design exercise","data-interpretation critique"]]
];

const authoredCurricula = authoredSubjectSeeds.map(([category, subject, title, learningOutcomes, units, methods]) => {
  const subjectRecord = learningSubjectIndex.find((item) => item.category === category && item.subject === subject);
  return {
    subjectId: subjectRecord.id,
    version: 1,
    title,
    suggestedLevels: ["primary", "middle", "secondary", "college", "adult"],
    prerequisites: [],
    learningOutcomes,
    units: units.map(([unitTitle, outcomes, concepts], index) => ({
      id: subjectRecord.id + "-unit-" + (index + 1),
      title: unitTitle,
      outcomes,
      concepts
    })),
    assessment: {
      methods,
      masteryRule: "Review each outcome separately. A learner demonstrates progress by explaining the reasoning, applying the idea to a new example and correcting misunderstandings; time spent alone is not evidence of mastery."
    },
    visualRequirements: [
      "Use a labelled visual or worked example when it clarifies the subject.",
      "Keep diagrams proportionate to the concept and label simplifications.",
      "Distinguish established facts from examples, estimates and interpretations."
    ],
    curriculumStatus: "authored",
    lessonStatus: "content-authored-review-required"
  };
});


const allAuthoredCurricula = [...learningCurricula, ...authoredCurricula];
const additionalAuthoredCurricula = [
  {
    "subjectId": "agriculture-food-systems-soil-science",
    "version": 1,
    "title": "Soil science: formation, texture and fertility",
    "suggestedLevels": [
      "middle",
      "secondary",
      "college",
      "adult"
    ],
    "prerequisites": [],
    "learningOutcomes": [
      "Explain key factors involved in soil formation",
      "Compare sand, silt and clay by drainage and water retention",
      "Describe how organic matter and conservation practices support soil health"
    ],
    "units": [
      {
        "id": "agriculture-food-systems-soil-science-unit-1",
        "title": "How soil forms",
        "outcomes": [
          "Identify weathering, parent material and organisms as soil-forming influences",
          "Recognise horizons in a simple soil profile"
        ],
        "concepts": [
          "weathering",
          "parent material",
          "horizon"
        ]
      },
      {
        "id": "agriculture-food-systems-soil-science-unit-2",
        "title": "Texture and water",
        "outcomes": [
          "Compare particle sizes of sand, silt and clay",
          "Predict drainage and water retention from texture"
        ],
        "concepts": [
          "sand",
          "silt",
          "clay",
          "permeability"
        ]
      },
      {
        "id": "agriculture-food-systems-soil-science-unit-3",
        "title": "Fertility and stewardship",
        "outcomes": [
          "Explain roles of organic matter and plant nutrients",
          "Choose a soil-conservation practice for a given site"
        ],
        "concepts": [
          "fertility",
          "organic matter",
          "erosion",
          "conservation"
        ]
      }
    ],
    "assessment": {
      "methods": [
        "soil-profile labelling",
        "texture comparison",
        "conservation case analysis"
      ],
      "masteryRule": "Check outcomes independently through explanation, application to a new example and correction of misunderstandings."
    },
    "visualRequirements": [
      "Use labelled visuals or worked examples where they clarify the concept.",
      "Identify simplifications and distinguish evidence from interpretation."
    ],
    "curriculumStatus": "authored",
    "lessonStatus": "content-authored-review-required"
  },
  {
    "subjectId": "arts-design-creativity-drawing",
    "version": 1,
    "title": "Drawing foundations: observation, proportion and value",
    "suggestedLevels": [
      "middle",
      "secondary",
      "college",
      "adult"
    ],
    "prerequisites": [],
    "learningOutcomes": [
      "Break a complex subject into basic observable shapes",
      "Use proportion and negative space to check relationships",
      "Use a value range to communicate form and light"
    ],
    "units": [
      {
        "id": "arts-design-creativity-drawing-unit-1",
        "title": "Observe and simplify",
        "outcomes": [
          "Identify major shapes and directional lines",
          "Draw from observation rather than relying only on symbols"
        ],
        "concepts": [
          "observation",
          "gesture",
          "shape",
          "contour"
        ]
      },
      {
        "id": "arts-design-creativity-drawing-unit-2",
        "title": "Proportion and space",
        "outcomes": [
          "Compare relative heights, widths and angles",
          "Use negative space to check alignment"
        ],
        "concepts": [
          "proportion",
          "alignment",
          "negative space"
        ]
      },
      {
        "id": "arts-design-creativity-drawing-unit-3",
        "title": "Light and form",
        "outcomes": [
          "Build a value scale from light to dark",
          "Use highlights and shadows to suggest volume"
        ],
        "concepts": [
          "value",
          "light source",
          "cast shadow",
          "form"
        ]
      }
    ],
    "assessment": {
      "methods": [
        "shape-blocking exercise",
        "proportion check",
        "value-study critique"
      ],
      "masteryRule": "Check outcomes independently through explanation, application to a new example and correction of misunderstandings."
    },
    "visualRequirements": [
      "Use labelled visuals or worked examples where they clarify the concept.",
      "Identify simplifications and distinguish evidence from interpretation."
    ],
    "curriculumStatus": "authored",
    "lessonStatus": "content-authored-review-required"
  },
  {
    "subjectId": "literature-media-poetry",
    "version": 1,
    "title": "Poetry: imagery, sound and interpretation",
    "suggestedLevels": [
      "middle",
      "secondary",
      "college",
      "adult"
    ],
    "prerequisites": [],
    "learningOutcomes": [
      "Identify a poem's speaker, situation and tone",
      "Explain how imagery and sound shape meaning",
      "Support an interpretation with specific textual evidence"
    ],
    "units": [
      {
        "id": "literature-media-poetry-unit-1",
        "title": "Voice and situation",
        "outcomes": [
          "Identify speaker, setting and situation",
          "Distinguish speaker from author"
        ],
        "concepts": [
          "speaker",
          "tone",
          "situation",
          "context"
        ]
      },
      {
        "id": "literature-media-poetry-unit-2",
        "title": "Imagery and sound",
        "outcomes": [
          "Interpret metaphor and simile in context",
          "Describe how rhythm, repetition or sound affects a line"
        ],
        "concepts": [
          "imagery",
          "metaphor",
          "simile",
          "rhythm"
        ]
      },
      {
        "id": "literature-media-poetry-unit-3",
        "title": "Interpret with evidence",
        "outcomes": [
          "Develop a reading supported by precise textual details",
          "Compare plausible interpretations respectfully"
        ],
        "concepts": [
          "close reading",
          "evidence",
          "ambiguity"
        ]
      }
    ],
    "assessment": {
      "methods": [
        "speaker-and-tone annotation",
        "imagery analysis",
        "evidence-supported interpretation"
      ],
      "masteryRule": "Check outcomes independently through explanation, application to a new example and correction of misunderstandings."
    },
    "visualRequirements": [
      "Use labelled visuals or worked examples where they clarify the concept.",
      "Identify simplifications and distinguish evidence from interpretation."
    ],
    "curriculumStatus": "authored",
    "lessonStatus": "content-authored-review-required"
  },
  {
    "subjectId": "earth-systems-sustainability-climate-systems",
    "version": 1,
    "title": "Climate change: evidence, impacts and responses",
    "suggestedLevels": [
      "middle",
      "secondary",
      "college",
      "adult"
    ],
    "prerequisites": [],
    "learningOutcomes": [
      "Distinguish daily weather from long-term climate patterns",
      "Explain the enhanced greenhouse effect through energy flow",
      "Compare mitigation and adaptation responses"
    ],
    "units": [
      {
        "id": "earth-systems-sustainability-climate-change-unit-1",
        "title": "Weather and climate",
        "outcomes": [
          "Explain the difference between weather and climate statistics",
          "Interpret a trend while recognising natural variability"
        ],
        "concepts": [
          "weather",
          "climate",
          "trend",
          "baseline"
        ]
      },
      {
        "id": "earth-systems-sustainability-climate-change-unit-2",
        "title": "Greenhouse effect",
        "outcomes": [
          "Describe how greenhouse gases interact with infrared energy",
          "Distinguish the natural effect from its human-driven enhancement"
        ],
        "concepts": [
          "infrared",
          "greenhouse gas",
          "energy balance",
          "emissions"
        ]
      },
      {
        "id": "earth-systems-sustainability-climate-change-unit-3",
        "title": "Responses and trade-offs",
        "outcomes": [
          "Classify actions as mitigation, adaptation or both",
          "Compare responses by effectiveness, equity and feasibility"
        ],
        "concepts": [
          "mitigation",
          "adaptation",
          "resilience",
          "equity"
        ]
      }
    ],
    "assessment": {
      "methods": [
        "weather-climate classification",
        "energy-flow explanation",
        "response trade-off analysis"
      ],
      "masteryRule": "Check outcomes independently through explanation, application to a new example and correction of misunderstandings."
    },
    "visualRequirements": [
      "Use labelled visuals or worked examples where they clarify the concept.",
      "Identify simplifications and distinguish evidence from interpretation."
    ],
    "curriculumStatus": "authored",
    "lessonStatus": "content-authored-review-required"
  },
  {
    "subjectId": "research-advanced-learning-scientific-method",
    "version": 1,
    "title": "Scientific method: questions, variables and evidence",
    "suggestedLevels": [
      "middle",
      "secondary",
      "college",
      "adult"
    ],
    "prerequisites": [],
    "learningOutcomes": [
      "Turn an observation into a focused, testable question",
      "Identify variables and design a fair comparison",
      "Interpret results without overstating what the data show"
    ],
    "units": [
      {
        "id": "research-advanced-learning-scientific-method-unit-1",
        "title": "Ask a testable question",
        "outcomes": [
          "Define the system or population being studied",
          "Write a question answerable with observable evidence"
        ],
        "concepts": [
          "observation",
          "research question",
          "scope",
          "testability"
        ]
      },
      {
        "id": "research-advanced-learning-scientific-method-unit-2",
        "title": "Design a fair test",
        "outcomes": [
          "Identify independent, dependent and controlled variables",
          "Choose measurements and repeats that reduce avoidable error"
        ],
        "concepts": [
          "variable",
          "control",
          "measurement",
          "replication"
        ]
      },
      {
        "id": "research-advanced-learning-scientific-method-unit-3",
        "title": "Interpret and communicate",
        "outcomes": [
          "Describe patterns without automatically claiming causation",
          "State limitations and a conclusion proportionate to the data"
        ],
        "concepts": [
          "result",
          "uncertainty",
          "limitation",
          "conclusion"
        ]
      }
    ],
    "assessment": {
      "methods": [
        "question-quality review",
        "variable-design exercise",
        "data-interpretation critique"
      ],
      "masteryRule": "Check outcomes independently through explanation, application to a new example and correction of misunderstandings."
    },
    "visualRequirements": [
      "Use labelled visuals or worked examples where they clarify the concept.",
      "Identify simplifications and distinguish evidence from interpretation."
    ],
    "curriculumStatus": "authored",
    "lessonStatus": "content-authored-review-required"
  }
];
export const completeAuthoredCurricula = [...new Map([...allAuthoredCurricula, ...additionalAuthoredCurricula].map((item) => [item.subjectId, item])).values()];
const curriculumBySubjectId = new Map(completeAuthoredCurricula.map((item) => [item.subjectId, item]));

export function getLearningCurriculum(subjectId) {
  return curriculumBySubjectId.get(subjectId) || null;
}

export function getLearningReadiness(subjectId) {
  const subject = learningSubjectIndex.find((item) => item.id === subjectId);
  if (!subject) return { subjectId, discovery: "unknown", curriculum: "not-authored", lesson: "not-authored" };
  const curriculum = getLearningCurriculum(subjectId);
  return { subjectId, discovery: "available", curriculum: curriculum?.curriculumStatus || "not-authored", lesson: curriculum?.lessonStatus || "not-authored", curriculumVersion: curriculum?.version ?? null };
}

export function getCatalogueCoverage() {
  return learningCategories.map((category) => {
    const subjects = category.subjects.map((name) => learningSubjectIndex.find((item) => item.category === category.name && item.subject === name)).filter(Boolean);
    const authored = subjects.filter((subject) => curriculumBySubjectId.has(subject.id)).length;
    const required = Math.ceil(subjects.length / 2);
    return { category: category.name, total: subjects.length, authored, required, percentage: subjects.length ? Math.round(authored / subjects.length * 100) : 0, reached: authored >= required };
  });
}

export function getCatalogueCoverageSummary() {
  const categories = getCatalogueCoverage();
  return { categoryCount: categories.length, subjectCount: categories.reduce((sum, item) => sum + item.total, 0), authoredCount: categories.reduce((sum, item) => sum + item.authored, 0), requiredCount: categories.reduce((sum, item) => sum + item.required, 0), categoriesAtTarget: categories.filter((item) => item.reached).length, categories };
}
