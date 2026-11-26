import test from "node:test";
import assert from "node:assert/strict";
import { buildImagePrompt, buildImageEditPrompt, classifyImageEditIntent, buildVideoPrompt, getCreativeProviderStatus } from "./creative-director.mjs";

test("masterpiece image direction adds composition, lighting, and detail guidance", () => {
  const prompt = buildImagePrompt("A glass perfume bottle on black marble", "masterpiece");
  assert.match(prompt, /visual hierarchy/i);
  assert.match(prompt, /tactile material detail/i);
  assert.match(prompt, /Treat the user prompt as a specification/i);
});

test("standard image direction stays minimal and unknown quality is rejected", () => {
  assert.equal(buildImagePrompt("A portrait", "standard"), "A portrait");
  assert.equal(buildImagePrompt("A portrait", "unknown"), null);
});

test("Ardhanarishvara gets a dedicated unified-form direction before standalone Shiva matching", () => {
  const prompt = buildImagePrompt("A hyper-realistic portrait of Ardhanarishvara, the divine half-male / half-female form of Shiva and Parvati", "masterpiece");
  assert.match(prompt, /one unified divine being/i);
  assert.match(prompt, /not two people standing together/i);
  assert.match(prompt, /VIEWER-LEFT HALF — Parvati/i);
  assert.match(prompt, /VIEWER-RIGHT HALF — Shiva/i);
  assert.match(prompt, /one face with two complementary halves/i);
  assert.match(prompt, /vertical division runs from the crown/i);
  assert.doesNotMatch(prompt, /not a generic saint/i);
  assert.doesNotMatch(prompt, /Depict Lord Shiva \(Mahadev\) unmistakably/);
});

test("Ardhanarishvara prompt keeps natural detail while honoring requested framing", () => {
  const portrait = buildImagePrompt("Ardhanarishvara, one combined form of Shiva and Parvati, vertical portrait", "masterpiece");
  assert.match(portrait, /realistic skin pores/i);
  assert.match(portrait, /favor a balanced vertical devotional portrait/i);
  assert.match(portrait, /avoid plastic skin/i);
  assert.match(portrait, /no duplicate features/i);

  const widescreen = buildImagePrompt("Ardhanarishvara, one combined form of Shiva and Parvati, widescreen 16:9 landscape", "masterpiece");
  assert.match(widescreen, /explicitly requested orientation, aspect ratio and framing/i);
  assert.match(widescreen, /never force a portrait crop when landscape or widescreen was requested/i);
  assert.doesNotMatch(widescreen, /vertical 3:4 portrait/i);
});

test("recognizes sacred subjects written in Kannada, Tamil and Telugu scripts", () => {
  const kannadaShiva = buildImagePrompt("ಶಿವನ ಸುಂದರ ಚಿತ್ರ", "masterpiece");
  assert.match(kannadaShiva, /Depict Lord Shiva \(Mahadev\) unmistakably/i);

  const tamilHanuman = buildImagePrompt("அனுமன் திருவுருவம்", "masterpiece");
  assert.match(tamilHanuman, /monkey-faced deity/i);

  const teluguGanesha = buildImagePrompt("గణేశుడు", "masterpiece");
  assert.match(teluguGanesha, /elephant-headed Hindu deity/i);

  const kannadaArdhanarishvara = buildImagePrompt("ಅರ್ಧನಾರೀಶ್ವರನ ದಿವ್ಯ ರೂಪ", "masterpiece");
  assert.match(kannadaArdhanarishvara, /one unified divine being/i);
  assert.match(kannadaArdhanarishvara, /VIEWER-LEFT HALF — Parvati/i);
});

test("standalone Shiva still receives the original Shiva-specific direction", () => {
  const prompt = buildImagePrompt("A portrait of Lord Shiva", "masterpiece");
  assert.match(prompt, /Depict Lord Shiva \(Mahadev\) unmistakably/i);
  assert.match(prompt, /tripundra ash stripes/i);
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

test("reference image edit uses a constrained edit brief rather than global generation art direction", () => {
  const prompt = buildImageEditPrompt(
    "A woman with short curly hair, round glasses, a blue jacket, standing beside a red bicycle",
    "Replace only the background with a quiet Kyoto street at dawn",
  );
  assert.match(prompt, /Original image brief: A woman with short curly hair/);
  assert.match(prompt, /Requested refinement: Replace only the background/);
  assert.match(prompt, /REFERENCE-LOCKED EDIT/);
  assert.match(prompt, /Modify only the specific region or attribute/i);
  assert.match(prompt, /facial geometry, eye shape and spacing, nose, lips, jawline/i);
  assert.match(prompt, /original camera viewpoint, perspective, crop, aspect ratio/i);
  assert.match(prompt, /Do not apply a global restyle/i);
  assert.match(prompt, /edit bleed onto protected faces/i);
  assert.doesNotMatch(prompt, /portfolio-worthy hero image/i);
  assert.doesNotMatch(prompt, /Creative direction: produce a premium/i);
});

test("reference image edit retains subject-specific sacred visual attributes without full image art direction", () => {
  const prompt = buildImageEditPrompt(
    "Generate Lord Shiva with a crescent moon, Ganga, tripundra and trident",
    "Make the background cinematic",
  );
  assert.match(prompt, /Original image brief: Generate Lord Shiva/i);
  assert.match(prompt, /Requested refinement: Make the background cinematic/i);
  assert.match(prompt, /Preserve the same people and their exact recognizable identity|IDENTITY LOCK/i);
  assert.match(prompt, /Lord Shiva \(Mahadev\) unmistakably/i);
  assert.doesNotMatch(prompt, /portfolio-worthy hero image/i);
});

test("reference image edit rejects empty instructions", () => {
  assert.equal(buildImageEditPrompt("A portrait", " "), null);
});

test("masterpiece direction protects explicit subject and composition constraints for every image", () => {
  const prompt = buildImagePrompt("A red bicycle, exactly three yellow balloons, subject on the left, in Kannada", "masterpiece");
  assert.match(prompt, /Treat the user prompt as a specification/i);
  assert.match(prompt, /exact requested subject identity/i);
  assert.match(prompt, /number of subjects and objects/i);
  assert.match(prompt, /left\/right placement/i);
  assert.match(prompt, /language it was written in/i);
  assert.match(prompt, /never invent text/i);
});

test("recognizes sacred subjects written in Hindi, Bengali and Gujarati scripts", () => {
  const hindiShiva = buildImagePrompt("शिव का दिव्य रूप", "masterpiece");
  assert.match(hindiShiva, /Depict Lord Shiva \(Mahadev\) unmistakably/i);

  const hindiArdhanarishvara = buildImagePrompt("अर्धनारीश्वर", "masterpiece");
  assert.match(hindiArdhanarishvara, /one unified divine being/i);

  const bengaliHanuman = buildImagePrompt("হনুমান", "masterpiece");
  assert.match(bengaliHanuman, /monkey-faced deity/i);

  const bengaliGanesha = buildImagePrompt("গণেশ", "masterpiece");
  assert.match(bengaliGanesha, /elephant-headed Hindu deity/i);

  const gujaratiKrishna = buildImagePrompt("શ્રીકૃષ્ણ", "masterpiece");
  assert.match(gujaratiKrishna, /peacock feather/i);

  const gujaratiRama = buildImagePrompt("શ્રીરામ", "masterpiece");
  assert.match(gujaratiRama, /traditional divine iconography/i);
});

test("classifies common image-to-image edit requests into explicit intent modes", () => {
  assert.deepEqual(classifyImageEditIntent("Enhance this photo and improve resolution"), ["enhance"]);
  assert.deepEqual(classifyImageEditIntent("Change the pose to a natural side-facing stance"), ["pose"]);
  assert.deepEqual(classifyImageEditIntent("Change the outfit to a black formal suit"), ["outfit"]);
  assert.deepEqual(classifyImageEditIntent("Create a promotional poster banner with this photo"), ["design"]);
  assert.deepEqual(classifyImageEditIntent("Replace the background with a beach at sunset"), ["background"]);
  assert.deepEqual(classifyImageEditIntent("Change pose and outfit, then make a poster banner"), ["pose", "outfit", "design"]);
  assert.deepEqual(classifyImageEditIntent("Make it more beautiful"), ["targeted"]);
  assert.equal(classifyImageEditIntent(" "), null);
});

test("enhancement mode protects original face, pose, outfit and composition", () => {
  const prompt = buildImageEditPrompt("A portrait of a woman", "Enhance this image, improve sharpness and upscale it");
  assert.match(prompt, /ENHANCEMENT MODE/);
  assert.match(prompt, /Preserve the exact person, face, expression, age, skin texture, hair, pose, outfit/);
  assert.match(prompt, /without inventing texture/);
  assert.doesNotMatch(prompt, /POSE-CHANGE MODE/);
});

test("pose change permits pose edits but keeps identity, face, clothing and scene protected", () => {
  const prompt = buildImageEditPrompt("A couple standing together", "Change their pose so they are looking at each other and holding hands");
  assert.match(prompt, /POSE-CHANGE MODE/);
  assert.match(prompt, /Preserve the same person's recognizable identity and facial geometry/);
  assert.match(prompt, /Preserve the outfit, accessories, setting, camera perspective/);
  assert.match(prompt, /coherent shoulders, spine, joints, hands, fingers/);
});

test("outfit change preserves the same person's face and body proportions", () => {
  const prompt = buildImageEditPrompt("A man wearing a casual shirt", "Change the outfit to a navy blue formal suit");
  assert.match(prompt, /OUTFIT-CHANGE MODE/);
  assert.match(prompt, /Preserve the same person's face, identity, skin tone/);
  assert.match(prompt, /Do not change body shape or facial appearance/);
  assert.match(prompt, /believable seams, fabric texture, folds/);
});

test("poster and banner mode preserves people and never invents event or contact text", () => {
  const prompt = buildImageEditPrompt("A portrait for a local event", "Create a vertical event poster banner with title 'Grand Opening' and date '12 December'");
  assert.match(prompt, /POSTER-AND-BANNER MODE/);
  assert.match(prompt, /Preserve the recognizable identity/);
  assert.match(prompt, /Use only exact wording supplied/);
  assert.match(prompt, /Never invent dates, phone numbers, addresses, prices/);
  assert.match(prompt, /Keep text clear, aligned, high-contrast/);
});

test("mixed edit requests preserve identity while enabling only named pose and outfit changes", () => {
  const prompt = buildImageEditPrompt("A portrait of a person outdoors", "Change the pose to arms crossed and outfit to a white blazer");
  assert.match(prompt, /POSE-CHANGE MODE/);
  assert.match(prompt, /OUTFIT-CHANGE MODE/);
  assert.match(prompt, /IDENTITY PRESERVATION/);
  assert.match(prompt, /Apply all requested changes and no unrelated changes/);
});

test("poster text safety does not ban explicitly requested poster wording", () => {
  const prompt = buildImageEditPrompt("A product photo", "Design a banner that says 'Aahana AI — Good ideas start somewhere.'");
  assert.match(prompt, /Aahana AI — Good ideas start somewhere/);
  assert.match(prompt, /Reproduce requested copy exactly/);
  assert.doesNotMatch(prompt, /Do not add captions, watermarks/);
});


test("reference-edit evaluation matrix separates requested changes from protected invariants", () => {
  const cases = [
    {
      name: "background replacement",
      source: "A woman with curly hair, round glasses, a blue jacket, standing beside a red bicycle",
      request: "Replace only the background with a quiet Kyoto street at dawn",
      required: ["BACKGROUND-CHANGE MODE", "same subject identity", "body proportions", "clothing", "foreground objects"],
      forbidden: ["POSE-CHANGE MODE", "OUTFIT-CHANGE MODE"],
    },
    {
      name: "couple pose change",
      source: "A couple in matching formal outfits, standing side by side",
      request: "Change their pose so they face each other and hold hands",
      required: ["POSE-CHANGE MODE", "recognizable identity", "facial geometry", "outfit, accessories, setting", "hands, fingers"],
      forbidden: ["OUTFIT-CHANGE MODE"],
    },
    {
      name: "wardrobe replacement",
      source: "A person in a casual shirt, standing in a garden",
      request: "Change only the outfit to a navy formal suit",
      required: ["OUTFIT-CHANGE MODE", "body proportions", "expression and pose", "original scene"],
      forbidden: ["POSE-CHANGE MODE", "BACKGROUND-CHANGE MODE"],
    },
    {
      name: "photo enhancement",
      source: "A close-up portrait with natural skin texture",
      request: "Enhance the image, reduce noise and improve sharpness",
      required: ["ENHANCEMENT MODE", "exact person, face, expression", "pose, outfit, accessories, background"],
      forbidden: ["POSE-CHANGE MODE", "OUTFIT-CHANGE MODE", "BACKGROUND-CHANGE MODE"],
    },
    {
      name: "poster from a portrait",
      source: "A portrait of a shop owner",
      request: "Create a vertical poster with the exact title 'Grand Opening' and date '12 December'",
      required: ["POSTER-AND-BANNER MODE", "recognizable identity", "exact wording", "Never invent dates, phone numbers"],
      forbidden: ["POSE-CHANGE MODE", "OUTFIT-CHANGE MODE"],
    },
  ];

  for (const scenario of cases) {
    const prompt = buildImageEditPrompt(scenario.source, scenario.request);
    assert.ok(prompt, scenario.name);
    for (const phrase of scenario.required) {
      assert.ok(prompt.toLowerCase().includes(phrase.toLowerCase()), `${scenario.name}: missing "${phrase}"`);
    }
    for (const phrase of scenario.forbidden) {
      assert.ok(!prompt.includes(phrase), `${scenario.name}: unexpectedly enabled "${phrase}"`);
    }
    assert.match(prompt, /REFERENCE-LOCKED EDIT/);
    assert.match(prompt, /CHANGE BOUNDARY/);
    assert.match(prompt, /Preserve every attribute not explicitly named/);
  }
});

test("reference-edit evaluation confirms requested pose changes do not authorize face or body redesign", () => {
  const prompt = buildImageEditPrompt(
    "Two people in a park, both wearing their original clothes",
    "Change their pose so they look at each other, but keep their faces, bodies and outfits the same",
  );
  assert.match(prompt, /POSE-CHANGE MODE/);
  assert.match(prompt, /exact recognizable identity/);
  assert.match(prompt, /facial geometry/);
  assert.match(prompt, /Preserve the outfit, accessories, setting/);
  assert.match(prompt, /Do not create a lookalike or alter the face/);
  assert.match(prompt, /Make only the requested refinement/);
});

test("reference-edit evaluation keeps poster copy exact and source text protected", () => {
  const prompt = buildImageEditPrompt(
    "A product photo with an existing printed label",
    "Create a banner using this product and include the exact text 'Aahana AI' and 'Good ideas start somewhere.'",
  );
  assert.match(prompt, /POSTER-AND-BANNER MODE/);
  assert.match(prompt, /Aahana AI/);
  assert.match(prompt, /Good ideas start somewhere\./);
  assert.match(prompt, /Keep source text unchanged unless the user explicitly requests a wording change/);
  assert.match(prompt, /Never fabricate text, names, dates, contact details/);
});
