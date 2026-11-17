const GLOBAL_RESEARCH_INTENT = /\b(?:global|worldwide|international|across (?:the )?world|compare countries|between countries|cross[- ]country|global south|regional perspectives|multiple regions|world's|worldwide)\b/i;

export function buildResearchQuery(prompt) {
  const question = String(prompt || "").trim().slice(0, 1000);
  if (!question || !GLOBAL_RESEARCH_INTENT.test(question)) return question;
  return `${question} Include geographically diverse evidence from multiple world regions, prioritize primary sources and local/regional institutions, and distinguish global patterns from country-specific findings.`.slice(0, 1400);
}

function canonicalSourceUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname.includes(".")) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.+|fbclid|gclid|mc_cid|mc_eid|ref_src)$/i.test(key)) url.searchParams.delete(key);
    }
    url.pathname = url.pathname.replace(/\/$/, "") || "/";
    url.searchParams.sort();
    return url.toString();
  } catch {
    return null;
  }
}

export function rankAndDedupeResearchResults(results, limit = 5) {
  const candidates = (Array.isArray(results) ? results : [])
    .filter((item) => item && typeof item.content === "string" && item.content.trim())
    .map((item) => ({ item, canonicalUrl: canonicalSourceUrl(item.url) }))
    .filter(({ canonicalUrl }) => canonicalUrl)
    .sort((a, b) => (Number(b.item.score) || 0) - (Number(a.item.score) || 0));

  const seen = new Set();
  const unique = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.canonicalUrl)) continue;
    seen.add(candidate.canonicalUrl);
    unique.push(candidate.item);
    if (unique.length >= limit) break;
  }
  return unique;
}
