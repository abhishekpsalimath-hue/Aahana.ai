export const MAX_PERSISTED_ASSISTANT_REPLY_CHARS = 64_000;

/** Keep complete normal model replies while placing a hard ceiling on stored output. */
export function prepareAssistantReplyForPersistence(value) {
  if (typeof value !== "string") return "";
  return value.slice(0, MAX_PERSISTED_ASSISTANT_REPLY_CHARS);
}
