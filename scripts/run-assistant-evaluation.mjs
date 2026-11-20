#!/usr/bin/env node
/**
 * Isolated provider-direct Aahana assistant benchmark.
 * - Uses the exact shared system prompt used by /api/chat.
 * - Calls Groq directly; never calls the app chat route or Supabase.
 * - Uses synthetic prompts only and writes reports to a local file.
 * - LLM-as-judge scores are diagnostic, not independent release approval.
 *
 * Run: GROQ_API_KEY=... node scripts/run-assistant-evaluation.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { ASSISTANT_EVALUATION_CASES, ASSISTANT_EVALUATION_RUBRIC, ASSISTANT_EVALUATION_VERSION, summarizeEvaluation } from "../src/lib/ai/assistant-evaluation.mjs";
import { buildAahanaSystemPrompt } from "../src/lib/ai/system-prompt.mjs";

const provider = (process.env.AAHANA_AI_PROVIDER || "groq").toLowerCase();
const apiKey = process.env.GROQ_API_KEY;
const model = process.env.AAHANA_MODEL || "openai/gpt-oss-120b";
const outputPath = resolve(process.argv[2] || `artifacts/aahana-evaluation-${new Date().toISOString().replaceAll(":", "-")}.json`);
const dimensions = ASSISTANT_EVALUATION_RUBRIC.dimensions;
const failureCodes = ASSISTANT_EVALUATION_RUBRIC.criticalFailures;

if (provider !== "groq") {
  throw new Error(`Isolated runner supports Groq only; configured provider is "${provider}". No fallback is attempted.`);
}
if (!apiKey) {
  throw new Error("GROQ_API_KEY is required in the local environment. The key is never read from or written to the repository.");
}

async function complete(messages, maxTokens) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: 0, max_completion_tokens: maxTokens }),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).replace(/[\\r\n\\t]+/g, " ").slice(0, 240);
    const error = new Error(`Groq request failed (${response.status}): ${detail}`);
    error.status = response.status;
    throw error;
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Groq returned an empty completion.");
  return content.trim();
}

function parseJson(text) {
  const triple = "`".repeat(3);
  const cleaned = text.replace(new RegExp("^" + triple + "(?:json)?\s*", "i"), "").replace(new RegExp("\s*" + triple + "$"), "").trim();
  return JSON.parse(cleaned);
}

function validJudgement(value) {
  return value && typeof value === "object" &&
    dimensions.every((key) => Number.isInteger(value.scores?.[key]) && value.scores[key] >= 1 && value.scores[key] <= 5) &&
    Array.isArray(value.criticalFailures) &&
    value.criticalFailures.every((item) => failureCodes.includes(item));
}

async function persist(results, metadata) {
  await mkdir(dirname(outputPath), { recursive: true });
  const summary = summarizeEvaluation(results);
  const report = {
    ...metadata,
    evaluationVersion: ASSISTANT_EVALUATION_VERSION,
    provider,
    model,
    results,
    summary: {
      ...summary,
      scoreGateEligible: summary.releaseEligible,
      releaseEligible: false,
      releaseNote: "Human review is required. These scores are produced by an LLM judge using the same provider family and are not an independent release certification.",
    },
    limitations: [
      "Provider-direct benchmark; does not call the Supabase-backed application chat route.",
      "Synthetic single-turn prompts only; no real user data or conversation history.",
      "Live Tavily research retrieval is not invoked by this isolated runner.",
      "Voice, image generation, video generation, browser interaction and UI flows are not tested.",
      "LLM-as-judge scores are provisional and require human review before any release decision.",
    ],
  };
  await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
}

const metadata = { startedAt: new Date().toISOString(), mode: "solve", isolation: "provider-direct/no-supabase" };
const results = [];
let stoppedEarly = false;

for (let index = 0; index < ASSISTANT_EVALUATION_CASES.length; index += 1) {
  const item = ASSISTANT_EVALUATION_CASES[index];
  try {
    const answer = await complete([
      { role: "system", content: buildAahanaSystemPrompt("solve") },
      { role: "user", content: item.prompt },
    ], 4096);

    const judgeText = await complete([
      {
        role: "system",
        content: [
          "You are a strict, evidence-minded quality evaluator. Judge only the supplied assistant response to the supplied synthetic prompt.",
          "Do not reward verbosity, confidence or polished formatting unless they improve correctness and usefulness.",
          "Score every dimension with an integer 1–5. 1 means critical failure or unusable; 2 major weaknesses; 3 partially correct with meaningful gaps; 4 strong with minor omissions; 5 accurate, complete and well-calibrated.",
          `Dimensions: ${dimensions.join(", ")}.`,
          `Allowed criticalFailures: ${failureCodes.join(", ")}. Return [] unless a listed failure is clearly present.`,
          "Return ONLY JSON: {\"scores\":{\"correctness_and_evidence\":1,\"completeness_and_relevance\":1,\"reasoning_quality\":1,\"clarity_and_language_match\":1,\"honesty_about_uncertainty\":1},\"criticalFailures\":[],\"rationale\":\"brief evidence-based rationale\"}.",
          "Do not infer a critical failure merely because a response is concise. Do not invent facts about tools used.",
        ].join("\n"),
      },
      { role: "user", content: JSON.stringify({ prompt: item.prompt, assistantResponse: answer }) },
    ], 1200);
    let judgement;
    try { judgement = parseJson(judgeText); } catch { judgement = null; }
    if (!validJudgement(judgement)) throw new Error("Judge returned invalid or incomplete rubric JSON.");
    results.push({
      id: item.id,
      category: item.category,
      prompt: item.prompt,
      answer,
      scores: judgement.scores,
      criticalFailures: judgement.criticalFailures,
      judgeRationale: String(judgement.rationale || "").slice(0, 1200),
    });
    process.stdout.write(`[${index + 1}/${ASSISTANT_EVALUATION_CASES.length}] ${item.id}: scored\n`);
  } catch (error) {
    results.push({
      id: item.id,
      category: item.category,
      prompt: item.prompt,
      scores: {},
      criticalFailures: [],
      evaluationError: String(error?.message || error).slice(0, 500),
    });
    process.stderr.write(`[${index + 1}/${ASSISTANT_EVALUATION_CASES.length}] ${item.id}: ${String(error?.message || error)}\n`);
    if ([401, 403, 429].includes(error?.status)) {
      stoppedEarly = true;
      break;
    }
  }
  await persist(results, { ...metadata, updatedAt: new Date().toISOString(), stoppedEarly });
}

await persist(results, { ...metadata, completedAt: new Date().toISOString(), stoppedEarly });
const summary = summarizeEvaluation(results);
process.stdout.write(JSON.stringify({
  outputPath,
  completed: results.length,
  expected: ASSISTANT_EVALUATION_CASES.length,
  scored: summary.scored,
  average: summary.average,
  atLeastFour: summary.atLeastFour,
  criticalFailures: summary.criticalFailures,
  scoreGateEligible: summary.releaseEligible,
  releaseEligible: false,
}, null, 2) + "\n");
