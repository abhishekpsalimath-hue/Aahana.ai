import test from "node:test";
import assert from "node:assert/strict";
import { buildImagePrompt, buildImageEditPrompt, buildVideoPrompt, getCreativeProviderStatus } from "./creative-director.mjs";

test("masterpiece image direction adds composition, lighting, and detail guidance", () => {
  const prompt = buildImagePrompt("A glass perfume bottle on black marble", "masterpiece");
  assert.match(prompt, /visual hierarchy/i);
  assert.match(prompt, /tactile material detail/i);
  assert.match(prompt, /Preserve the subject/i);
});

test("standard image direction stays minimal and unknown quality is rejected", () => {
  assert.equal(buildImagePrompt("A portrait", "standard"), "User request (preserve exactly): A portrait");
  assert.equal(buildImagePrompt("A portrait", "unknown"), null);
});

test("cinematic video direction adds camera, continuity, and motion guidance", () => {
  const prompt = buildVideoPrompt("A lone astronaut walks across a red desert");
  assert.match(prompt, /motivated camera movement/i);
  assert.match(prompt, /spatial continuity/i);
  assert.match(prompt, /flicker/i);
});

test("video director presets are validated and none preserves the original prompt", () => {
  assert.equal(buildVideoPrompt("A scene", "none"), "A scene");
  assert.equal(buildVideoPrompt("A scene", "unknown"), null);
  assert.match(buildVideoPrompt("A bottle", "commercial"), /premium/i);
});

test("provider registry reports configuration without exposing credentials", () => {
  const status = getCreativeProviderStatus({
    CLOUDFLARE_ACCOUNT_ID: "account",
    CLOUDFLARE_API_TOKEN: "secret",
    ELEVENLABS_API_KEY: "voice-secret",
  });
  assert.equal(status.find((item) => item.id === "cloudflare").configured, true);
  assert.equal(status.find((item) => item.id === "elevenlabs").configured, true);
  assert.equal(status.find((item) => item.id === "higgsfield").configured, false);
  assert.equal(JSON.stringify(status).includes("secret"), false);
});


test("reference image edit prompt preserves original sacred subject identity", () => {
  const prompt = buildImageEditPrompt(
    "Generate Lord Shiva with a crescent moon, Ganga, tripundra and trident",
    "Make the background cinematic"
  );
  assert.match(prompt, /Original image brief: Generate Lord Shiva/i);
  assert.match(prompt, /Requested refinement: Make the background cinematic/i);
  assert.match(prompt, /Preserve the exact main subject, identity, face, anatomy, pose/i);
  assert.match(prompt, /Lord Shiva \(Mahadev\) unmistakably/i);
});

test("reference image edit prompt rejects empty instructions", () => {
  assert.equal(buildImageEditPrompt("A portrait", " "), null);
});

test("prioritizes sacred identity and honors a specifically requested Shiva manifestation", () => {
  const prompt = buildImagePrompt("Create Lord Shiva as Nataraja, dancing within the ring of fire", "masterpiece");
  assert.ok(prompt.indexOf("Depict Lord Shiva") < prompt.indexOf("User request (preserve exactly):"));
  assert.match(prompt, /Nataraja/);
  assert.match(prompt, /do not replace it with the standard seated-yogi depiction/i);
  assert.match(prompt, /Include only attributes compatible with the specified form/i);
  assert.match(prompt, /portfolio-worthy hero image/i);
});

test("preserves Hanuman's requested multi-faced form and unmistakable vanara identity", () => {
  const prompt = buildImagePrompt("Create Panchamukhi Hanuman with five distinct faces", "masterpiece");
  assert.match(prompt, /Panchamukhi Hanuman/);
  assert.match(prompt, /clearly read as a monkey-faced vanara/i);
  assert.match(prompt, /do not substitute a single-faced generic depiction/i);
});

test("keeps the user's exact visual request explicit for all supported sacred subjects", () => {
  for (const name of ["Ganesha", "Krishna", "Rama"]) {
    const prompt = buildImagePrompt("Create Lord " + name + " in the requested traditional form", "masterpiece");
    assert.match(prompt, /User request \(preserve exactly\):/);
    assert.ok(prompt.indexOf("User request (preserve exactly):") > prompt.indexOf("Depict Lord"));
  }
});

test("preserves other explicitly named Shiva manifestations without forcing a seated-yogi form", () => {
  for (const form of ["Ardhanarishvara", "Dakshinamurthy"]) {
    const prompt = buildImagePrompt("Create Lord Shiva as " + form + " in the traditional form", "masterpiece");
    assert.match(prompt, new RegExp(form));
    assert.match(prompt, /preserve the requested form and scene exactly/i);
    assert.match(prompt, /do not replace it with the standard seated-yogi depiction/i);
    assert.match(prompt, /User request \(preserve exactly\):/);
  }
});

test("sacred identity guardrails recognize Kannada and Hindi deity names", () => {
  const cases = [
    ["ಶಿವನ ಚಿತ್ರ ರಚಿಸಿ", /Lord Shiva \(Mahadev\) unmistakably/i],
    ["महादेव का चित्र बनाओ", /Lord Shiva \(Mahadev\) unmistakably/i],
    ["ಆಂಜನೇಯ ಸ್ವಾಮಿಯ ಚಿತ್ರ ಬಿಡಿಸಿ", /Lord Hanuman \(Anjaneya\) unmistakably/i],
    ["हनुमान का दिव्य चित्र बनाओ", /Lord Hanuman \(Anjaneya\) unmistakably/i],
    ["ಗಣಪತಿಯ ಚಿತ್ರ ಮಾಡಿ", /Lord Ganesha unmistakably/i],
    ["श्रीकृष्ण का चित्र बनाओ", /Lord Krishna unmistakably/i],
    ["ಶ್ರೀರಾಮನ ಚಿತ್ರ ರಚಿಸಿ", /Lord Rama unmistakably/i],
  ];
  for (const [request, expectedIdentity] of cases) {
    assert.match(buildImagePrompt(request, "standard"), expectedIdentity, request);
  }
});
