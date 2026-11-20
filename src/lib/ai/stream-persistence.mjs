// Persist a streamed assistant reply at most once across normal completion,
// stream cancellation and competing cleanup paths.
export function createReplyPersistence({ getContent, persist, onError = () => {} }) {
  let persistencePromise = null;
  return function persistReplyOnce() {
    const content = String(getContent() || "").slice(0, 16000);
    if (!content.trim()) return Promise.resolve();
    if (!persistencePromise) {
      persistencePromise = (async () => {
        try { await persist(content); }
        catch (error) { onError(error); }
      })();
    }
    return persistencePromise;
  };
}
