export const MAX_PERSISTED_ASSISTANT_REPLY_CHARS = 64_000;

/** Keep complete normal model replies while placing a hard ceiling on stored output. */
export function prepareAssistantReplyForPersistence(value) {
  if (typeof value !== "string") return "";
  let bounded = value.slice(0, MAX_PERSISTED_ASSISTANT_REPLY_CHARS);
  // String#slice counts UTF-16 code units; avoid persisting an unpaired high surrogate
  // when the size ceiling lands between the two halves of a supplementary character.
  const lastCodeUnit = bounded.charCodeAt(bounded.length - 1);
  if (lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff) {
    bounded = bounded.slice(0, -1);
  }
  return bounded;
}
