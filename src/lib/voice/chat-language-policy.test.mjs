import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const routePath = fileURLToPath(new URL("../../app/api/chat/route.js", import.meta.url));
const routeSource = readFileSync(routePath, "utf8");

const multilingualPolicy = [
  "Support multilingual conversations across Indian regional languages and international languages",
  "Identify the language from meaning and context, not from writing-system detection alone",
  "Reply in the language the user is using unless they explicitly request another language",
  "When the user code-switches, understand the full message and respond naturally in the same language mix",
  "Understand common romanized and transliterated forms of Indian and other languages",
  "Do not mistake Latin letters for proof that the user is speaking English",
  "Use the script the user appears to prefer",
  "Preserve names, technical terms, code, numbers, units and quoted text accurately",
  "If the language or dialect genuinely cannot be identified with confidence, ask one brief clarification",
];

test("chat route keeps the complete multilingual response policy", () => {
  for (const requirement of multilingualPolicy) {
    assert.ok(
      routeSource.includes(requirement),
      `Missing multilingual chat policy requirement: ${requirement}`,
    );
  }
});

test("multilingual policy is part of the system prompt sent to the model", () => {
  const promptStart = routeSource.indexOf("const systemPrompt = [");
  const promptEnd = routeSource.indexOf("].join(\" \");", promptStart);
  assert.notEqual(promptStart, -1, "System prompt declaration must exist");
  assert.notEqual(promptEnd, -1, "System prompt array must be closed");
  const systemPrompt = routeSource.slice(promptStart, promptEnd);
  for (const requirement of multilingualPolicy) {
    assert.ok(
      systemPrompt.includes(requirement),
      `Requirement is not in the actual system prompt: ${requirement}`,
    );
  }
});
