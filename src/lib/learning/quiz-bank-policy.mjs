const MAX_FIELD_LENGTH = 100;
const QUIZ_PACK_SCHEMA_VERSION = 1;

function cleanField(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_FIELD_LENGTH);
}

function keyPart(value) {
  return cleanField(value, "not-specified").toLocaleLowerCase("en-US");
}

/**
 * Stable, versioned identity for a quiz pack.
 * This is a catalogue key only; persistence and generation are separate layers.
 */
export function createQuizPackKey(input = {}) {
  const fields = [
    keyPart(input.subject),
    keyPart(input.topic),
    keyPart(input.gradeBand),
    keyPart(input.curriculum),
    keyPart(input.language),
    keyPart(input.difficulty),
    String(Number.isInteger(input.contentVersion) && input.contentVersion > 0 ? input.contentVersion : 1),
  ];
  return `quiz:v${QUIZ_PACK_SCHEMA_VERSION}:${fields.map(encodeURIComponent).join("|")}`;
}

function normalizeQuestionText(value) {
  return cleanField(value).toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/**
 * Non-cryptographic FNV-1a 64-bit fingerprint for duplicate detection.
 * Never use this as an integrity, authentication, or security hash.
 */
function fingerprintText(value) {
  let hash = 0xcbf29ce484222325n;
  for (const char of value) {
    const codePoint = char.codePointAt(0);
    hash ^= BigInt(codePoint);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

export function createQuizPackFingerprint(questions) {
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > 10) return null;
  const normalized = questions.map((question) => {
    const stem = normalizeQuestionText(question?.question ?? question?.prompt ?? question?.text);
    const options = Array.isArray(question?.options)
      ? question.options.map(normalizeQuestionText).filter(Boolean).sort()
      : [];
    if (!stem) return null;
    return `${stem}::${options.join("~")}`;
  });
  if (normalized.some((item) => !item)) return null;
  return fingerprintText(normalized.join("\n---\n"));
}

/**
 * Returns unseen packs while preserving input order.
 * Existing fingerprints should come from the same normalized question format.
 */
export function removeDuplicateQuizPacks(packs, existingFingerprints = []) {
  if (!Array.isArray(packs)) return [];
  const seen = new Set(
    Array.isArray(existingFingerprints)
      ? existingFingerprints.filter((value) => typeof value === "string" && /^[a-f0-9]{16}$/i.test(value))
      : [],
  );
  const unique = [];
  for (const pack of packs) {
    const fingerprint = createQuizPackFingerprint(pack?.questions);
    if (!fingerprint || seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    unique.push({ ...pack, fingerprint });
  }
  return unique;
}

export const quizBankPolicyVersion = QUIZ_PACK_SCHEMA_VERSION;

export const supportedQuizVisuals = Object.freeze([
  "fraction", "orbit", "water-cycle", "plant-growth", "number-line", "molecule",
  "concept-map", "timeline", "bar-chart", "anatomy", "circuit", "code-flow",
  "sound-wave", "map", "3d-solar-system", "3d-planet", "3d-molecule", "3d-atom",
  "3d-dna", "3d-geometry", "3d-terrain", "3d-plant-cell", "3d-heart",
  "3d-pyramid", "3d-ecosystem", "3d-engine", "3d-cart",
]);

/**
 * Validate untrusted model output before it reaches the interactive quiz UI.
 * Invalid packs fail closed; this does not certify factual correctness.
 */
export function validateQuizPack(value, { minQuestions = 5, maxQuestions = 10 } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.type !== "aahana_quiz_v1") return null;
  if (!Array.isArray(value.questions) || value.questions.length < minQuestions || value.questions.length > maxQuestions) return null;
  const title = cleanField(value.title, "A little challenge");
  const seenStems = new Set();
  const questions = [];

  for (const item of value.questions) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const question = cleanField(item.question);
    const explanation = cleanField(item.explanation);
    const hint = cleanField(item.hint);
    if (!question || question.length < 8 || !explanation || !hint) return null;
    const stemKey = normalizeQuestionText(question);
    if (seenStems.has(stemKey)) return null;
    seenStems.add(stemKey);

    if (!Array.isArray(item.options) || item.options.length !== 4) return null;
    const options = item.options.map((option) => cleanField(option));
    const optionKeys = options.map(normalizeQuestionText);
    if (options.some((option) => !option) || new Set(optionKeys).size !== 4) return null;
    if (!Number.isInteger(item.correctIndex) || item.correctIndex < 0 || item.correctIndex > 3) return null;
    if (!supportedQuizVisuals.includes(item.visual)) return null;

    questions.push({
      question,
      options,
      correctIndex: item.correctIndex,
      explanation,
      hint,
      visual: item.visual,
    });
  }

  const fingerprint = createQuizPackFingerprint(questions);
  if (!fingerprint) return null;
  return { type: "aahana_quiz_v1", title, questions, fingerprint };
}
