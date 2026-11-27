function stableSerialize(value) {
  if (Array.isArray(value)) return "[" + value.map(stableSerialize).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map((key) =>
      JSON.stringify(key) + ":" + stableSerialize(value[key])
    ).join(",") + "}";
  }
  return JSON.stringify(value);
}

export function createAgentToolCallLedger() {
  return { ids: new Set(), fingerprints: new Set() };
}

export function recordAgentToolCalls(ledger, calls) {
  if (!ledger || !(ledger.ids instanceof Set) || !(ledger.fingerprints instanceof Set) ||
      !Array.isArray(calls) || calls.length < 1) {
    return { ok: false, error: "The agent tool-call ledger is invalid." };
  }

  const pendingIds = new Set();
  const pendingFingerprints = new Set();
  const fingerprints = [];

  for (const call of calls) {
    if (!call || typeof call.id !== "string" || typeof call.name !== "string" ||
        !call.args || typeof call.args !== "object" || Array.isArray(call.args)) {
      return { ok: false, error: "The agent returned an invalid tool call." };
    }
    const fingerprint = call.name + ":" + stableSerialize(call.args);
    if (ledger.ids.has(call.id) || pendingIds.has(call.id)) {
      return { ok: false, error: "The agent repeated a tool-call identifier across execution rounds." };
    }
    if (ledger.fingerprints.has(fingerprint) || pendingFingerprints.has(fingerprint)) {
      return { ok: false, error: "The agent repeated an identical tool request. The previous result must be used or the request must be changed." };
    }
    pendingIds.add(call.id);
    pendingFingerprints.add(fingerprint);
    fingerprints.push(fingerprint);
  }

  for (const id of pendingIds) ledger.ids.add(id);
  for (const fingerprint of fingerprints) ledger.fingerprints.add(fingerprint);
  return { ok: true };
}
