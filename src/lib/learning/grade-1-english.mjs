/**
 * Grade 1 English foundational literacy curriculum.
 * Authored as lesson content; it does not create student locks or grade gates.
 */
const unit = (id, title, objective, teach, example, question, options, answer, explanation, checks, practice, visual, interaction) => ({
  id, title, objective, teach, example, question, options, answer, explanation, checks, practice,
  lessonDesign: {
    visual,
    interaction,
    scenes: [
      { title: "Notice it", focus: objective, activity: "Explore a large, clear visual example and say what you notice." },
      { title: "Try it together", focus: "Connect the example to a sound, word or sentence.", activity: "Use a guided activity with immediate, kind feedback." },
      { title: "Use it yourself", focus: "Apply the idea in a new context.", activity: practice }
    ],
    feedback: "If an answer is incorrect, model the idea, give a gentle hint and invite another try with a different example."
  },
  assessmentDesign: {
    warmUp: "Start with an oral observation, sound or picture prompt.",
    formativeChecks: checks,
    independentCheck: question,
    mastery: "Look for the skill in a fresh example and in the learner's own spoken or written work."
  }
});

export const GRADE_1_ENGLISH_CURRICULUM = {
  id: "grade-1-english",
  grade: 1,
  subject: "English",
  title: "Grade 1 English",
  version: 1,
  alignment: {
    status: "board-neutral-core",
    mappedBoards: [],
    note: "Foundational English literacy core. Board-specific textbook, sequence and language-outcome mapping still requires review."
  },
  designPrinciples: [
    "Build listening, speaking, phonological awareness, reading and writing together.",
    "Use short, decodable examples and familiar vocabulary before increasing complexity.",
    "Accept oral responses and multiple ways of demonstrating understanding where appropriate.",
    "Correct gently: model, prompt and retry rather than shame or lock the learner out."
  ],
  units: [
    unit("listening-and-sounds", "Listening for sounds", "Listen carefully, recognise familiar environmental sounds and notice rhyming words.", [
      "Listening means paying attention to sounds and words.",
      "Some words rhyme because their ending sounds are alike, such as cat and hat.",
      "Words can begin with the same sound even when they do not rhyme.",
      "Say a word slowly and listen for the sounds you can hear."
    ], "Sun and fun rhyme. Sun and sock begin with the same first sound.", "Which pair of words rhymes?", ["dog and log", "dog and sun", "cat and cup"], 0, "Dog and log have the same ending sound.", [
      { question: "Which word rhymes with pin?", options: ["win", "pot", "sun"], answer: 0, explanation: "Pin and win share the ending sound." },
      { question: "Which two words begin with the same sound?", options: ["moon and map", "fish and sun", "ball and kite"], answer: 0, explanation: "Moon and map both begin with the /m/ sound." },
      { question: "What should you do to hear a word carefully?", options: ["Listen closely", "Shout over it", "Ignore its sounds"], answer: 0, explanation: "Careful listening helps us notice sounds in words." }
    ], "Say three words that rhyme with a word chosen by your teacher or family.", "sound-wave", "listen-and-match"),
    unit("letters-and-sounds", "Letters and their sounds", "Recognise common letter forms and connect letters with their usual sounds.", [
      "Letters are symbols we use to write words.",
      "The alphabet has uppercase and lowercase letters.",
      "Many letters represent a sound, and some letters can represent more than one sound in different words.",
      "Look at a letter, say its sound and find a familiar word that begins with it."
    ], "B and b are two forms of the same letter. Ball begins with the /b/ sound.", "Which letter begins the word sun?", ["M", "S", "T"], 1, "Sun begins with the letter S and the /s/ sound.", [
      { question: "Which is the lowercase form of A?", options: ["a", "B", "D"], answer: 0, explanation: "The lowercase form of A is a." },
      { question: "Which word begins with the /m/ sound?", options: ["fish", "moon", "cake"], answer: 1, explanation: "Moon begins with the /m/ sound." },
      { question: "Which letter begins the word apple?", options: ["A", "P", "L"], answer: 0, explanation: "Apple begins with A." }
    ], "Choose five letters, say their common sounds and draw one matching object for each.", "alphabet-cards", "letter-sound-match"),
    unit("words-and-meaning", "Words and meaning", "Understand and use familiar nouns, action words and describing words.", [
      "A naming word, or noun, can name a person, place, animal or thing.",
      "An action word, or verb, tells what someone or something does.",
      "A describing word gives us more information about a person, place, animal or thing.",
      "Pictures and the other words in a sentence can help us understand a new word."
    ], "The small bird sings. Bird names an animal, small describes it and sings tells an action.", "Which word tells an action: 'The girl runs'?", ["girl", "the", "runs"], 2, "Runs tells what the girl does, so it is an action word.", [
      { question: "Which is a naming word?", options: ["jump", "tree", "quickly"], answer: 1, explanation: "Tree names a thing." },
      { question: "Which word describes the flower?", options: ["beautiful", "grow", "flower"], answer: 0, explanation: "Beautiful describes the flower." },
      { question: "Which word is an action?", options: ["blue", "dance", "pencil"], answer: 1, explanation: "Dance tells an action." }
    ], "Describe a favourite object using two describing words and one complete spoken sentence.", "picture-vocabulary", "word-sort"),
    unit("read-simple-texts", "Read simple texts", "Read short, familiar sentences and identify who or what they are about.", [
      "A sentence shares a complete idea.",
      "Look at the words from left to right in English.",
      "Use letter sounds, familiar words and picture clues together when reading.",
      "After reading, ask: who is this about, what happened and where did it happen?"
    ], "Ria has a red bag. The sentence tells us who has the bag and what colour it is.", "In 'The dog runs', who runs?", ["The dog", "The cat", "The boy"], 0, "The sentence says that the dog runs.", [
      { question: "What does a reader do?", options: ["Look at and understand words", "Only count pictures", "Skip every word"], answer: 0, explanation: "Reading connects written words with meaning." },
      { question: "In 'Mia sees a bird', what does Mia see?", options: ["A ball", "A bird", "A tree"], answer: 1, explanation: "The sentence tells us Mia sees a bird." },
      { question: "Which clue can help you understand a story?", options: ["The words and pictures", "The page colour only", "Guessing without reading"], answer: 0, explanation: "Words and relevant pictures work together to support meaning." }
    ], "Read a short picture book aloud with a partner and retell one thing that happened.", "storybook-sequence", "sentence-picture-match"),
    unit("sentences-and-writing", "Build and write sentences", "Write simple sentences with spaces, an initial capital letter and suitable end punctuation.", [
      "A sentence begins with a capital letter.",
      "Leave a space between words so the reader can see each word.",
      "A statement often ends with a full stop. A question ends with a question mark.",
      "Say your sentence aloud, write it and reread it to check that it makes sense."
    ], "I like mangoes. begins with a capital I and ends with a full stop.", "Which sentence is written correctly?", ["i see a cat", "I see a cat.", "Iseeacat"], 1, "The sentence has a capital letter, spaces and a full stop.", [
      { question: "Which mark can end a question?", options: ["?", ".", ","], answer: 0, explanation: "A question mark shows that the sentence asks something." },
      { question: "What should come between two words?", options: ["A space", "A full stop", "A capital letter every time"], answer: 0, explanation: "Spaces help separate words." },
      { question: "Which is a capital letter?", options: ["g", "G", "q"], answer: 1, explanation: "G is the uppercase form." }
    ], "Write two sentences about a picture. Check capitals, spaces and end marks.", "sentence-builder", "word-order"),
    unit("speaking-and-sharing", "Speak, listen and share", "Share ideas in short spoken sentences, listen to others and respond politely.", [
      "A clear speaker uses words that others can hear and understand.",
      "A good listener looks towards the speaker when comfortable and waits for a turn.",
      "Ask a question when you want to know more.",
      "Retell an event in an order that helps another person follow it."
    ], "First I planted a seed. Then I watered it. These words help show the order.", "Which word can show what happened next?", ["Then", "Because", "Blue"], 0, "Then helps show the next event in a sequence.", [
      { question: "What is a helpful listening habit?", options: ["Interrupting", "Waiting for a turn", "Talking over a friend"], answer: 1, explanation: "Waiting for a turn gives everyone a chance to speak." },
      { question: "Which is a polite way to ask?", options: ["Can you please explain?", "Be quiet!", "I will not listen."], answer: 0, explanation: "A polite question invites someone to explain." },
      { question: "Which word can begin a retelling?", options: ["First", "Purple", "Under"], answer: 0, explanation: "First helps introduce the beginning of an event." }
    ], "Tell a partner about a favourite activity using first, next and last.", "conversation-scene", "sequence-and-speak")
  ],
  qualityGate: [
    "Decodable text and age-appropriate vocabulary reviewed",
    "Letter-sound examples checked for the intended pronunciation",
    "Reading tasks do not rely on colour alone",
    "Oral and written response alternatives considered",
    "Board-specific language outcomes reviewed before alignment claims"
  ]
};
