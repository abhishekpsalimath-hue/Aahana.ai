import test from "node:test";
import assert from "node:assert/strict";
import { shouldSearchWeb } from "./research-intent.mjs";

test("detects English requests for current information and sources", () => {
  assert.equal(shouldSearchWeb("What are the latest AI announcements?"), true);
  assert.equal(shouldSearchWeb("Research recent studies about sleep"), true);
  assert.equal(shouldSearchWeb("Compare prices as of 2026"), true);
});

test("detects Indian-language freshness phrases", () => {
  assert.equal(shouldSearchWeb("ಇತ್ತೀಚಿನ AI ಸುದ್ದಿಗಳು ಯಾವುವು?"), true);
  assert.equal(shouldSearchWeb("आज की ताज़ा खबरें बताओ"), true);
  assert.equal(shouldSearchWeb("இன்றைய சமீபத்திய செய்திகள்"), true);
});

test("detects international-language freshness and web-search phrases", () => {
  assert.equal(shouldSearchWeb("¿Cuáles son las últimas noticias?"), true);
  assert.equal(shouldSearchWeb("Quelles sont les dernières recherches ?"), true);
  assert.equal(shouldSearchWeb("最新のAIニュースを検索して"), true);
  assert.equal(shouldSearchWeb("最新のAIニュースを検索して", null), true);
  assert.equal(shouldSearchWeb("ما آخر الأخبار اليوم؟"), true);
});

test("detects date-scoped requests", () => {
  assert.equal(shouldSearchWeb("What changed in 2026-11-23?"), true);
  assert.equal(shouldSearchWeb("Tell me about events in November 2026"), true);
});

test("does not trigger web search for ordinary evergreen questions", () => {
  assert.equal(shouldSearchWeb("Explain how photosynthesis works"), false);
  assert.equal(shouldSearchWeb("Explain the difference between mass and weight"), false);
});

test("does not run web search for image-analysis prompts", () => {
  assert.equal(shouldSearchWeb("What is in this picture?", { dataUrl: "data:image/png;base64,AA==" }), false);
});
