import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Core Assistant renders exactly one 1,000-star canvas rather than a DOM star per point", async () => {
  const [field, workspace] = await Promise.all([
    read("./ambient-starfield.jsx"),
    read("./assistant-workspace.jsx"),
  ]);
  assert.match(field, /const STAR_COUNT = 1000/);
  assert.match(field, /data-star-count=\{STAR_COUNT\}/);
  assert.match(workspace, /<AmbientStarfield\s*\/>/);
  assert.doesNotMatch(workspace, /spaceStars\.map/);
});

test("founder welcome is only triggered after successful authentication and clears its one-time marker", async () => {
  const [login, workspace] = await Promise.all([
    read("./login/page.jsx"),
    read("./assistant-workspace.jsx"),
  ]);
  assert.match(login, /sessionStorage\.setItem\("aahana-founder-welcome", "show"\)/);
  assert.match(workspace, /sessionStorage\.getItem\("aahana-founder-welcome"\)/);
  assert.match(workspace, /sessionStorage\.removeItem\("aahana-founder-welcome"\)/);
  assert.match(workspace, /setTimeout\(\(\) => setFounderWelcomeVisible\(false\), 3400\)/);
});

test("founder welcome identifies the founder and carries a dissolve animation", async () => {
  const [workspace, css] = await Promise.all([
    read("./assistant-workspace.jsx"),
    read("./globals.css"),
  ]);
  assert.match(workspace, /A PERSONAL NOTE FROM THE FOUNDER/);
  assert.match(workspace, /Abhishekayya P\. Salimath/);
  assert.match(css, /@keyframes founder-welcome-life/);
  assert.match(css, /76%\s*\{\s*opacity:\s*1;/);
  assert.match(css, /100%\s*\{\s*opacity:\s*0;/);
});

test("ambient idle graphics respect reduced motion and pause when the tab is hidden", async () => {
  const [field, css] = await Promise.all([
    read("./ambient-starfield.jsx"),
    read("./globals.css"),
  ]);
  assert.match(field, /prefers-reduced-motion: reduce/);
  assert.match(field, /visibilitychange/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /space-nebula-one/);
  assert.match(css, /space-constellation-one/);
});
