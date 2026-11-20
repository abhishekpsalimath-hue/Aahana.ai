import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workspaceCss = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
const learningCss = readFileSync(new URL("./learn/learning-studio.css", import.meta.url), "utf8");
const learningStudio = readFileSync(new URL("./learn/learning-studio.jsx", import.meta.url), "utf8");

test("workspace exposes visible keyboard focus for interactive controls", () => {
  assert.match(workspaceCss, /:where\(button, a, input, textarea, select, \[role="button"\], \[role="tab"\]\):focus-visible/);
  assert.match(workspaceCss, /outline: 2px solid var\(--lilac\)/);
});

test("workspace hover motion is limited to fine pointer devices", () => {
  assert.match(workspaceCss, /@media \(hover: hover\) and \(pointer: fine\)/);
  assert.match(workspaceCss, /\.starter:hover[\s\S]*?transform: translateY\(-2px\)/);
});

test("workspace respects reduced motion and disables ambient animation", () => {
  assert.match(workspaceCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(workspaceCss, /\.space-star,[\s\S]*?\.signal-spark \{\s*animation: none !important;/);
  assert.match(workspaceCss, /transition-duration: 0\.01ms !important/);
});

test("Student Mode accessibility selectors target real learning studio controls", () => {
  const renderedClassLists = learningStudio
    .split(/className\s*=\s*"/)
    .slice(1)
    .map((attribute) => attribute.split('"', 1)[0].split(/\s+/));
  for (const className of [
    "learning-mode-picker",
    "learning-topic-actions",
    "learning-quiz-options",
    "learning-quiz-feedback",
    "learning-quiz-finish",
    "learning-memory-panel",
    "learning-discovery-selects",
  ]) {
    assert.ok(renderedClassLists.some((classes) => classes.includes(className)), `${className} must exist as a rendered JSX class`);
  }
});

test("Student Mode has visible focus, touch handling and reduced-motion rules", () => {
  assert.match(learningCss, /\.learning-quiz-options button:focus-visible/);
  assert.match(learningCss, /touch-action: manipulation/);
  assert.match(learningCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(learningCss, /transition: none !important/);
});


test("assistant mode launchpad changes guidance and offers a usable starter prompt", () => {
  const workspace = readFileSync(new URL("./assistant-workspace.jsx", import.meta.url), "utf8");
  assert.match(workspace, /className="mode-launchpad"/);
  assert.match(workspace, /modes\.find\(\(item\) => item\.id === mode\)\?\.description/);
  assert.match(workspace, /setPrompt\(modes\.find\(\(item\) => item\.id === mode\)\?\.prompt/);
});

test("mode launchpad motion respects reduced-motion preferences", () => {
  assert.match(workspaceCss, /\.launch-orbit-one,\.launch-orbit-two,\.launch-core\{animation:none!important\}/);
  assert.match(workspaceCss, /@media\(max-width:620px\)/);
});
