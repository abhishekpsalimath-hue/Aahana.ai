import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("./page.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./share.module.css", import.meta.url), "utf8");

test("public introduction welcomes Aahana users from its named founder", () => {
  assert.match(page, /A warm welcome to everyone joining/);
  assert.match(page, /Abhishekayya Salimath/);
  assert.match(page, /href="\/login"/);
});

test("public introduction renders 220 deterministic stars and respects reduced motion", () => {
  assert.match(page, /const STAR_COUNT = 220/);
  assert.match(page, /length: STAR_COUNT/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /\.starField span:nth-child\(4n\)/);
});
