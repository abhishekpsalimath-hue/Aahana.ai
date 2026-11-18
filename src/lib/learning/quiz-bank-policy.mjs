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
