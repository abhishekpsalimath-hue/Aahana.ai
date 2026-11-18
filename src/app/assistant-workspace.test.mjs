import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workspace = readFileSync(new URL("./assistant-workspace.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

test("signed-in users receive a founder welcome that dissolves after three seconds", () => {
  assert.match(workspace, /Welcome to Aahana AI\./);
  assert.match(workspace, /From Abhishekayya Salimath/);
  assert.match(workspace, /setDissolvingLoginWelcome\(true\), 3000\)/);
  assert.match(workspace, /setShowLoginWelcome\(false\), 3900\)/);
  assert.match(styles, /founder-welcome-dissolve \.9s/);
});

test("founder welcome respects reduced-motion preferences", () => {
  assert.match(styles, /prefers-reduced-motion:reduce/);
  assert.match(styles, /founder-welcome-note\.is-dissolving\{animation:none/);
});


test("workspace navigation is collapsed by default and can be opened from the three-line menu", () => {
  assert.match(workspace, /const \[sidebarOpen, setSidebarOpen\] = useState\(false\)/);
  assert.match(workspace, /className=\{sidebarOpen \? "shell sidebar-expanded" : "shell sidebar-collapsed"\}/);
  assert.match(workspace, /className=\{sidebarOpen \? "sidebar sidebar-visible" : "sidebar sidebar-hidden"\}/);
  assert.match(workspace, /className="menu-toggle"[\s\S]*aria-expanded=\{sidebarOpen\}/);
  assert.match(workspace, /<span \/><span \/><span \/>/);
  assert.match(workspace, /className="sidebar-close"[\s\S]*setSidebarOpen\(false\)/);
  assert.match(styles, /\.sidebar\.sidebar-hidden\{display:none\}/);
});

test("navigation remains usable as a mobile overlay when expanded", () => {
  assert.match(styles, /\.sidebar\.sidebar-visible\{display:flex;position:fixed/);
  assert.ok(styles.includes(".sidebar.sidebar-visible .side-item"));
});
