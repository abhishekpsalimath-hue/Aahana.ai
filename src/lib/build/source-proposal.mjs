const MAX_SOURCE_BYTES = 1024 * 1024;

export function validateSourceProposal(raw, { fileName, version }) {
  if (typeof raw !== "string" || raw.length > MAX_SOURCE_BYTES * 2) {
    throw new Error("Aahana returned an invalid or oversized code proposal.");
  }
  const normalized = raw.trim().replace(/^\x60{3}(?:json)?\s*/i, "").replace(/\s*\x60{3}$/, "");
  let proposal;
  try { proposal = JSON.parse(normalized); }
  catch { throw new Error("Aahana's proposal was not valid JSON. Ask again or edit the source manually."); }

  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal) ||
      proposal.fileName !== fileName || proposal.baseVersion !== version ||
      typeof proposal.summary !== "string" || !proposal.summary.trim() ||
      proposal.summary.length > 500 || typeof proposal.updatedContent !== "string") {
    throw new Error("Aahana's proposal did not match the open source file and version.");
  }
  const bytes = new TextEncoder().encode(proposal.updatedContent).byteLength;
  if (bytes < 1 || bytes > MAX_SOURCE_BYTES || proposal.updatedContent.includes("\u0000")) {
    throw new Error("The proposed source must contain 1 byte to 1 MB of valid text.");
  }
  return {
    fileName,
    baseVersion: version,
    summary: proposal.summary.trim(),
    updatedContent: proposal.updatedContent,
    sizeBytes: bytes,
  };
}
