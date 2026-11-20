import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("./route.js", import.meta.url), "utf8");

test("live research can search, extract full page content and crawl a requested website", () => {
  assert.match(route, /tavilyRequest\("search"/);
  assert.match(route, /tavilyRequest\("extract"/);
  assert.match(route, /tavilyRequest\("crawl"/);
  assert.match(route, /wantsSiteDiscovery/);
  assert.match(route, /max_depth: 3/);
  assert.match(route, /limit: 30/);
  assert.match(route, /allow_external: false/);
});

test("website research is bounded, source-grounded and does not claim complete coverage", () => {
  assert.match(route, /AbortSignal\.timeout\(timeoutMs\)/);
  assert.match(route, /let budget = 30000/);
  assert.match(route, /untrusted source content/);
  assert.match(route, /not proof that every page on a large website was inspected/);
  assert.match(route, /Never invent citations/);
});

test("research citations are restricted to retrieved HTTPS source URLs", () => {
  assert.match(route, /parsed\.protocol !== "https:"/);
  assert.match(route, /allowedResearchUrls = sources/);
  assert.match(route, /hasVerifiedCitation/);
});

test("Student Mode remains excluded from the Core Assistant knowledge instructions", () => {
  assert.match(route, /mode === "learn" \? \[\] : \[CORE_KNOWLEDGE_INSTRUCTIONS\]/);
});


test("Student Mode keeps its existing search-only path and never enters Core Assistant crawling", () => {
  assert.match(route, /if \(mode === "learn"\) \{/);
  assert.match(route, /if \(mode === "learn"\)[\s\S]*?const searchResponse = await fetch\("https:\/\/api\.tavily\.com\/search"/);
  assert.match(route, /if \(mode === "learn"\)[\s\S]*?\.slice\(0, 5\)[\s\S]*?\} else \{[\s\S]*?tavilyRequest\("crawl"/);
});


test("Student Mode retains its original web-search trigger while Core Assistant adds website discovery", () => {
  const legacyMatcher = route.slice(route.indexOf("function shouldSearchWeb"), route.indexOf("function shouldSearchCoreWeb"));
  assert.doesNotMatch(legacyMatcher, /website|web site|site audit|site map/i);
  assert.match(route, /function shouldSearchCoreWeb/);
  assert.match(route, /const requiresLiveResearch = mode === "learn" \? shouldSearchWeb\(prompt, image\) : shouldSearchCoreWeb\(prompt, image\)/);
});


test("Core Assistant research keeps retrieval and model calls inside the server time budget", () => {
  assert.match(route, /timeout: 20,[\s\S]*?\}, 22000\)/);
  assert.match(route, /\}, 8000\)/);
  assert.match(route, /\}, 12000\)/);
  assert.match(route, /AbortSignal\.timeout\(requiresLiveResearch \? 32000 : 45000\)/);
  assert.match(route, /export const maxDuration = 60/);
});


test("Core Assistant recognizes HTTPS and bare-domain website research requests", () => {
  assert.match(route, /rawRequestedUrl/);
  assert.match(route, /https:\/\/\" \+ rawRequestedUrl/);
  assert.match(route, /\|research\|analy\[sz\]e\|review\|documentation/);
});
