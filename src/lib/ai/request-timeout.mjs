// Combine a caller's cancellation signal with a bounded provider timeout.
// Aborting the incoming request stops downstream provider work as well.
export function createRequestTimeoutSignal(requestSignal, timeoutMs) {
  if (!requestSignal || typeof requestSignal.addEventListener !== "function") {
    throw new TypeError("A valid request AbortSignal is required.");
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("timeoutMs must be a positive finite number.");
  }
  return AbortSignal.any([requestSignal, AbortSignal.timeout(timeoutMs)]);
}

// A disconnected client is not an upstream provider failure. Stop the route
// without returning a misleading 502/503 or attempting fallback work.
export function getClientAbortResponse(requestSignal) {
  return requestSignal?.aborted ? new Response(null, { status: 499 }) : null;
}
