const INTENTS = Object.freeze([
  { id: "enquiries", terms: ["enquiry", "lead", "prospect", "customer follow-up", "follow up"], reason: "Enquiry capture and owner assignment" },
  { id: "invoice", terms: ["invoice", "bill", "supplier", "expense", "payment review"], reason: "Invoice field validation and human review" },
  { id: "daily", terms: ["daily", "every morning", "weekday", "sales summary", "business summary", "daily report"], reason: "Scheduled data collection and summary preparation" },
]);

const MIN_MATCHES = 1;

function containsPhrase(text, phrase) {
  return (" " + text + " ").includes(" " + phrase + " ");
}

export function suggestWorkflowTemplate(request) {
  if (typeof request !== "string" || !request.trim()) {
    return { matched: false, templateId: null, confidence: "none", reason: "Describe the outcome you want first.", planner: "keyword-assisted-v1" };
  }
  const normalized = request.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
  const ranked = INTENTS.map((intent) => {
    const matches = intent.terms.filter((term) => containsPhrase(normalized, term)).length;
    return { ...intent, matches };
  }).sort((a, b) => b.matches - a.matches);
  const best = ranked[0];
  if (!best || best.matches < MIN_MATCHES || ranked[1]?.matches === best.matches) {
    return { matched: false, templateId: null, confidence: "none", reason: "No clear starter matched. Choose a template manually; no workflow was generated.", planner: "keyword-assisted-v1" };
  }
  return {
    matched: true,
    templateId: best.id,
    confidence: best.matches > 1 ? "moderate" : "low",
    reason: best.reason,
    planner: "keyword-assisted-v1",
  };
}
