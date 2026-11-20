import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workspace = readFileSync(new URL("./assistant-workspace.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

test("Core Assistant keeps its persistent navigation and astronaut welcome", () => {
  assert.match(workspace, /<main className="shell">/);
  assert.match(workspace, /<aside className="sidebar">/);
  assert.match(workspace, /<Link className="brand"/);
  assert.match(workspace, /className="astronaut-float"/);
  assert.match(workspace, /className="welcome"/);
  assert.doesNotMatch(workspace, /sidebar-collapsed|sidebar-hidden|sidebarOpen|menu-toggle/);
});

test("Core Assistant does not replace the established welcome with a timed transient note", () => {
  assert.doesNotMatch(workspace, /showLoginWelcome|dissolvingLoginWelcome|founder-welcome-note/);
  assert.doesNotMatch(styles, /founder-welcome-note|founder-welcome-dissolve/);
});

test("workspace keeps its established persistent sidebar layout", () => {
  assert.match(styles, /\.shell\{min-height:100vh;display:grid;grid-template-columns:248px minmax\(0,1fr\)\}/);
  assert.match(styles, /\.sidebar\{position:sticky;top:0;height:100vh/);
  assert.doesNotMatch(styles, /sidebar-collapsed|sidebar-hidden|sidebar-visible|menu-toggle/);
});
