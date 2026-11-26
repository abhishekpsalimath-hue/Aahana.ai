import test from "node:test";
import assert from "node:assert/strict";
import { compileVideoStoryboard, VIDEO_STORYBOARD_LIMITS } from "./video-storyboard.mjs";

const storyboard = () => ({
  title: "A hero product reveal",
  visualStyle: "Premium cinematic product film, warm studio light, realistic materials",
  continuity: { subjectId: "bottle-hero", wardrobeId: "none", propIds: ["cap-01", "label-01"] },
  shots: [
    { id: "shot-01", durationSeconds: 4, scene: "Dark studio with a narrow rim light", action: "Bottle slowly emerges from shadow", camera: "Slow forward dolly, medium-wide hero framing", transition: "start" },
    { id: "shot-02", durationSeconds: 5, scene: "Same studio and lighting direction", action: "Camera reveals the bottle label and condensation", camera: "Controlled macro push-in, shallow depth of field", transition: "match-cut" },
    { id: "shot-03", durationSeconds: 3, scene: "Same studio with a clean reflective surface", action: "Bottle settles into a centered final hero pose", camera: "Slow pull-back to a symmetrical product frame", transition: "dissolve" },
  ],
});

test("compiles an ordered, timed storyboard with a global continuity lock", () => {
  const result = compileVideoStoryboard(storyboard(), "Premium water bottle commercial");
  assert.equal(result.durationSeconds, 12);
  assert.equal(result.shots.length, 3);
  assert.deepEqual(result.continuity.propIds, ["cap-01", "label-01"]);
  assert.match(result.prompt, /same subject identity \(bottle-hero\)/);
  assert.match(result.prompt, /SHOT 1 \(0–4s; 4s\)/);
  assert.match(result.prompt, /SHOT 2 \(4–9s; 5s\)/);
  assert.match(result.prompt, /Transition: match-cut/);
  assert.match(result.scope, /may not follow every shot boundary exactly/);
});

test("defaults omitted transitions to start then cuts", () => {
  const input = storyboard();
  input.shots[0].transition = undefined;
  input.shots[1].transition = undefined;
  const result = compileVideoStoryboard(input);
  assert.equal(result.shots[0].transition, "start");
  assert.equal(result.shots[1].transition, "cut");
});

test("rejects missing global continuity, invalid shot count and duration overflow", () => {
  const noLock = storyboard();
  delete noLock.continuity;
  assert.throws(() => compileVideoStoryboard(noLock), /continuity lock/);
  const oneShot = storyboard();
  oneShot.shots = oneShot.shots.slice(0, 1);
  assert.throws(() => compileVideoStoryboard(oneShot), /between 2 and 6/);
  const tooLong = storyboard();
  tooLong.shots[0].durationSeconds = 8;
  tooLong.shots[1].durationSeconds = 8;
  assert.throws(() => compileVideoStoryboard(tooLong), /15-second/);
});

test("rejects duplicate ids, malformed durations and invalid transition placement", () => {
  const duplicate = storyboard();
  duplicate.shots[1].id = duplicate.shots[0].id;
  assert.throws(() => compileVideoStoryboard(duplicate), /unique/);
  const badDuration = storyboard();
  badDuration.shots[0].durationSeconds = 0;
  assert.throws(() => compileVideoStoryboard(badDuration), /integer/);
  const badFirstTransition = storyboard();
  badFirstTransition.shots[0].transition = "cut";
  assert.throws(() => compileVideoStoryboard(badFirstTransition), /first shot/);
  const badTransition = storyboard();
  badTransition.shots[2].transition = "teleport";
  assert.throws(() => compileVideoStoryboard(badTransition), /supported transition/);
});

test("requires stable unique opaque continuity identifiers", () => {
  const badSubject = storyboard();
  badSubject.continuity.subjectId = "../secret";
  assert.throws(() => compileVideoStoryboard(badSubject), /stable opaque identifier/);
  const duplicateProps = storyboard();
  duplicateProps.continuity.propIds = ["prop-1", "prop-1"];
  assert.throws(() => compileVideoStoryboard(duplicateProps), /unique stable identifiers/);
});

test("bounds prompt size and returns immutable normalized metadata", () => {
  const input = storyboard();
  input.shots[0].scene = "x".repeat(181);
  assert.throws(() => compileVideoStoryboard(input), /1–180 characters/);
  const result = compileVideoStoryboard(storyboard());
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.shots));
  assert.ok(Object.isFrozen(result.continuity.propIds));
  assert.equal(VIDEO_STORYBOARD_LIMITS.maxDurationSeconds, 15);
});
