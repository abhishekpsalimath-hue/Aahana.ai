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

export function createSourceDiff(before, after) {
  if (typeof before !== "string" || typeof after !== "string") return "";
  if (before === after) return "No source changes proposed.";
  const oldLines = before.split("\n");
  const newLines = after.split("\n");
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix++;
  let suffix = 0;
  while (suffix < oldLines.length - prefix && suffix < newLines.length - prefix &&
      oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]) suffix++;
  const contextStart = Math.max(0, prefix - 3);
  const oldEnd = oldLines.length - suffix;
  const newEnd = newLines.length - suffix;
  const output = ["--- current source", "+++ proposed source", "@@ lines " + (contextStart + 1) + " @@",
    ...oldLines.slice(contextStart, prefix).map((line) => "  " + line),
    ...oldLines.slice(prefix, oldEnd).map((line) => "- " + line),
    ...newLines.slice(prefix, newEnd).map((line) => "+ " + line),
    ...oldLines.slice(oldEnd, Math.min(oldLines.length, oldEnd + 3)).map((line) => "  " + line),
  ];
  return output.join("\n");
}
