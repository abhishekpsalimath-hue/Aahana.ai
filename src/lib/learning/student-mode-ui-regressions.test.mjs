import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const studio = readFileSync(new URL("../../app/learn/learning-studio.jsx", import.meta.url), "utf8");
const world = readFileSync(new URL("../../app/learn/interactive-3d-world.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../app/learn/learning-studio.css", import.meta.url), "utf8");

test("quiz remains sequential and advances only after a correct answer", () => {
  assert.match(studio, /const \[currentIndex, setCurrentIndex\] = useState\(0\)/);
  assert.match(studio, /!completed && <section/);
  assert.match(studio, /setCurrentIndex\(\(index\) => index \+ 1\)/);
  assert.match(studio, /Finish my journey/);
});

test("quiz retains retry, restart, first-try tracking and personalised revision", () => {
  assert.match(studio, /function retry\(index\)/);
  assert.match(studio, /function restart\(\)/);
  assert.match(studio, /firstTryCorrect/);
  assert.match(studio, /learning-quiz-review/);
  assert.match(studio, /learning-revision-steps/);
  assert.match(studio, /onClick=\{restart\}/);
});

test("3D renderer adapts quality to mobile, constrained hardware and reduced motion", () => {
  assert.match(world, /hardwareConcurrency/);
  assert.match(world, /prefers-reduced-motion: reduce/);
  assert.match(world, /constrainedDevice \? 1\.25 : 2/);
  assert.match(world, /shadowMap\.enabled = !constrainedDevice/);
  assert.match(world, /receiveShadow = renderer\.shadowMap\.enabled/);
});

test("Student Mode and revision styles remain present with reduced-motion fallback", () => {
  assert.match(styles, /\.student-welcome/);
  assert.match(styles, /\.learning-quiz-review/);
  assert.match(styles, /\.learning-revision-steps/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
});
