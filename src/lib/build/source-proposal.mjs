export const MAX_PROPOSAL_SOURCE_BYTES = 5000;

const MAX_SOURCE_BYTES = 1024 * 1024;
const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\\bgithub_pat_[A-Za-z0-9_]{20,}\\b/,
  /\\bgh[pousr]_[A-Za-z0-9]{20,}\\b/,
  /\\bsk_(?:live|test)_[A-Za-z0-9]{16,}\\b/,
  /\\bAKIA[0-9A-Z]{16}\\b/,
];

export function validateSourceProposal(raw, { fileName, version }) {
  if (typeof raw !== "string" || raw.length > MAX_SOURCE_BYTES * 2) {
    throw new Error("Aahana returned an invalid or oversized code proposal.");
  }
  const normalized = raw.trim().replace(/^\\x60{3}(?:json)?\\s*/i, "").replace(/\\s*\\x60{3}$/, "");
  let proposal;
  try { proposal = JSON.parse(normalized); }
  catch { throw new Error("Aahana's proposal was not valid JSON. Ask again or edit the source manually."); }

  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal) ||
      Object.keys(proposal).sort().join(",") !== "baseVersion,fileName,summary,updatedContent" ||
      proposal.fileName !== fileName || proposal.baseVersion !== version ||
      typeof proposal.summary !== "string" || !proposal.summary.trim() ||
      proposal.summary.length > 500 || typeof proposal.updatedContent !== "string") {
    throw new Error("Aahana's proposal did not match the open source file and version.");
  }
  const bytes = new TextEncoder().encode(proposal.updatedContent).byteLength;
  if (bytes < 1 || bytes > MAX_SOURCE_BYTES || proposal.updatedContent.includes("\\u0000")) {
    throw new Error("The proposed source must contain 1 byte to 1 MB of valid text.");
  }
  if (SECRET_PATTERNS.some((pattern) => pattern.test(proposal.updatedContent))) {
    throw new Error("A possible credential was detected in the proposal. Remove it before reviewing this change.");
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
  const oldLines = before.split("\\n");
  const newLines = after.split("\\n");
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix++;
  let suffix = 0;
  while (suffix < oldLines.length - prefix && suffix < newLines.length - prefix &&
      oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]) suffix++;
  const contextStart = Math.max(0, prefix - 3);
  const oldEnd = oldLines.length - suffix;
  const newEnd = newLines.length - suffix;
  const removed = oldLines.slice(prefix, oldEnd);
  const added = newLines.slice(prefix, newEnd);
  const maxChangedLines = 300;
  const output = ["--- current source", "+++ proposed source", "@@ lines " + (contextStart + 1) + " @@",
    ...oldLines.slice(contextStart, prefix).map((line) => "  " + line),
    ...removed.slice(0, maxChangedLines).map((line) => "- " + line),
    ...added.slice(0, maxChangedLines).map((line) => "+ " + line),
    ...oldLines.slice(oldEnd, Math.min(oldLines.length, oldEnd + 3)).map((line) => "  " + line),
  ];
  if (removed.length > maxChangedLines || added.length > maxChangedLines) {
    output.push("… diff truncated (" + removed.length + " removed lines, " + added.length + " added lines)");
  }
  const rendered = output.join("\\n");
  return rendered.length > 40_000 ? rendered.slice(0, 40_000) + "\\n… diff preview truncated for performance" : rendered;
}
