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
    "ഇന്നത്തെ പുതിയ വാർത്തകൾ ഉറവിടങ്ങളോടെ പറയൂ",
  ]) assert.equal(shouldSearchWeb(prompt), true, prompt);
});

test("stable conceptual questions do not force a live search", () => {
  for (const prompt of [
    "Explain photosynthesis in simple words.",
    "What is a binary search tree?",
    "Teach me the basics of orbital mechanics.",
    "Write a short poem about rain.",
    "How does a transformer work?",
  ]) assert.equal(shouldSearchWeb(prompt), false, prompt);
});

test("image analysis does not accidentally invoke web research", () => {
  assert.equal(shouldSearchWeb("Identify this plant", { dataUrl: "data:image/png;base64,..." }), false);
});

test("live research recognises more international languages and scripts", () => {
  for (const prompt of [
    "আজকের সাম্প্রতিক খবর উৎসসহ বলুন",
    "આજના તાજેતરના સમાચાર સ્ત્રોતો સાથે આપો",
    "ਅੱਜ ਦੀਆਂ ਤਾਜ਼ਾ ਖ਼ਬਰਾਂ ਸਰੋਤਾਂ ਸਮੇਤ ਦੱਸੋ",
    "آج کی تازہ ترین خبریں ذرائع کے ساتھ بتائیں",
    "أحدث الأخبار اليوم مع المصادر",
    "今天的最新新闻，请附上来源",
    "今日の最新ニュースを出典付きで教えて",
    "오늘 최신 뉴스를 출처와 함께 알려줘",
    "Последние новости сегодня с источниками",
    "Dame las últimas noticias de hoy con fuentes.",
    "Donne-moi les dernières actualités avec des sources.",
    "Gib mir die neuesten Nachrichten heute mit Quellen.",
  ]) assert.equal(shouldSearchWeb(prompt), true, prompt);
});
