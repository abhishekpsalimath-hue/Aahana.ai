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
