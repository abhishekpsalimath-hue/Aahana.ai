import test from "node:test";
import assert from "node:assert/strict";
import { shouldSearchWeb } from "../src/lib/chat/research-intent.mjs";

test("live research is selected for explicit freshness and source requests", () => {
  for (const prompt of [
    "What is the latest in battery technology?",
    "Research recent peer-reviewed studies on ocean microplastics.",
    "Find official documentation and verify the current API behaviour.",
    "Give me a deep dive with evidence and sources.",
    "What changed in November 2026?",
    "Compare current prices for these models.",
  ]) assert.equal(shouldSearchWeb(prompt), true, prompt);
});

test("live research recognises regional-language freshness requests", () => {
  for (const prompt of [
    "ಇತ್ತೀಚಿನ AI ಸಂಶೋಧನೆಗಳ ಬಗ್ಗೆ ಮೂಲಗಳೊಂದಿಗೆ ವಿವರಿಸಿ",
    "आज की ताज़ा खबरें स्रोतों के साथ बताइए",
    "சமீபத்திய விண்வெளி ஆராய்ச்சியைத் தேடுங்கள்",
    "తాజా సాంకేతిక వార్తలను మూలాలతో వివరించండి",
    "ಇವತ್ತಿನ AI updates mattu recent developments heli",
    "ಇವತ್ತು share market rates enu?",
    "aaj ki taaza khabrein sources ke saath bataiye",
    "taaza samachar aur latest announcements",
    "aaj ke current prices compare karo",
    "ಇಂದಿನ ಹೊಸ technology suddi heli",
  ]) assert.equal(shouldSearchWeb(prompt), true, prompt);
});

test("stable conceptual questions do not force a live search", () => {
  for (const prompt of [
    "Explain photosynthesis in simple words.",
    "What is a binary search tree?",
    "Teach me the basics of orbital mechanics.",
    "Write a short poem about rain.",
    "How does a transformer work?",
    "Write a fictional story about ivattu",
    "Teach me Kannada grammar using the word samachar",
    "Explain what taaza means in Hindi",
  ]) assert.equal(shouldSearchWeb(prompt), false, prompt);
});

test("image analysis does not accidentally invoke web research", () => {
  assert.equal(shouldSearchWeb("Identify this plant", { dataUrl: "data:image/png;base64,..." }), false);
});

test("research topic classification recognises transliterated regional news terms", async () => {
  const { getResearchTopic } = await import("../src/lib/chat/research-intent.mjs");
  for (const prompt of [
    "aaj ki taaza khabrein",
    "ivattina suddi",
    "latest samachara",
  ]) assert.equal(getResearchTopic(prompt), "news", prompt);
  for (const prompt of [
    "Explain how photosynthesis works",
    "Explain orbital mechanics",
    "Teach me Kannada grammar",
  ]) assert.equal(getResearchTopic(prompt), "general", prompt);
});
