// Creates an idempotent persistence callback for a streamed assistant reply.
// The first completion/cancellation path wins; subsequent calls share the same promise.
export function createReplyPersistence({ getContent, persist, onError = () => {} }) {
  let persistencePromise = null;

  return function persistReplyOnce() {
    const content = String(getContent() || "").slice(0, 16000);
    if (!content.trim()) return Promise.resolve();

    if (!persistencePromise) {
      persistencePromise = (async () => {
        try {
          await persist(content);
        } catch (error) {
          onError(error);
        }
      })();
    }

    return persistencePromise;
  };
}
