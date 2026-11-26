import test from "node:test";
import assert from "node:assert/strict";
import { buildImagePrompt } from "../src/lib/creative/creative-director.mjs";
import { parseImageGenerationInput } from "../src/lib/creative/image-generation.mjs";

// A deliberately varied regression set: the goal is to test instruction fidelity
// across subjects, styles, spatial relationships, exact text, diagrams and languages.
const cases = [
  ["person", "A documentary-style portrait of one elderly fisherman with weathered skin, seated on the left side of a wooden boat at dawn."],
  ["person", "A young woman scientist wearing a white lab coat, safety glasses and blue gloves, standing beside a microscope in a bright laboratory."],
  ["people-count", "Exactly three cyclists riding in a line from left to right on a coastal road; no other people."],
  ["hands", "Close-up of two human hands carefully repairing a small mechanical watch, five natural fingers on each visible hand."],
  ["animal", "A Bengal tiger walking through a misty forest, full body visible, natural striped coat and realistic proportions."],
  ["animal", "A red fox sitting in fresh snow at blue hour, looking toward the camera, with both ears and all four paws visible."],
  ["product", "A matte-black reusable water bottle with a brushed-steel cap, isolated on a warm ivory studio background."],
  ["product-detail", "A premium running shoe shown in exact side profile, with visible mesh weave, layered sole and clean laces; no brand logo."],
  ["architecture", "A contemporary coastal house with two floors, a flat roof, three large glass panels and a shaded timber terrace."],
  ["architecture", "An old stone temple courtyard after rain, wet paving reflecting soft morning light, no modern buildings."],
  ["landscape", "A wide 16:9 aerial view of terraced green rice fields in Karnataka with a narrow river running diagonally from upper left to lower right."],
  ["landscape", "A vertical 3:4 photograph of a lone pine tree on a rocky ridge beneath a pale sunrise."],
  ["composition", "A red vintage bicycle in the foreground on the right, a yellow brick wall behind it, and open negative space on the left."],
  ["composition", "A small glass vase centered on a table, a single white flower leaning to the upper right, plain charcoal background."],
  ["typography", "A clean event poster containing exactly this headline: 'BUILD WHAT MATTERS' and this date: '18 DECEMBER 2026'. No other words."],
  ["typography", "A minimalist book cover with the exact title 'THE QUIET ORBIT' and author name 'A. SALIMATH'; preserve spelling and punctuation."],
  ["diagram", "An educational water-cycle diagram with four labeled stages: EVAPORATION, CONDENSATION, PRECIPITATION, COLLECTION."],
  ["diagram", "A simple electric circuit diagram showing one battery, one switch, one bulb and connecting wires; no extra components."],
  ["science", "A scientifically plausible cross-section of Earth showing crust, mantle, outer core and inner core in four distinct layers."],
  ["science", "A realistic spiral galaxy viewed at a 35-degree tilt, with a bright central bulge and four clearly separated curved arms."],
  ["food", "A top-down photograph of a South Indian thali with rice, sambar, rasam, two vegetable sides, papad and curd in separate bowls."],
  ["fashion", "A full-length editorial photograph of a model wearing a deep emerald-green silk saree with a gold border, standing naturally."],
  ["vehicle", "A cobalt-blue electric city bus photographed from the front three-quarter angle on a clean urban street."],
  ["interior", "A warm minimalist reading room with one walnut bookshelf, one cream armchair, a floor lamp and a large window."],
  ["illustration", "A hand-painted watercolor illustration of a red panda holding a small bamboo branch, soft edges and visible paper texture."],
  ["3d", "A high-quality 3D render of a translucent amber glass sphere on a dark stone plinth, with physically plausible reflections."],
  ["cinematic", "A cinematic wide shot of a small astronaut standing near a vast icy crater, with a distant ringed planet low on the horizon."],
  ["Kannada", "ಮಳೆ ಬಿದ್ದ ನಂತರದ ಹಸಿರು ಹೊಲದಲ್ಲಿ ನಿಂತಿರುವ ಒಬ್ಬ ರೈತನ ನೈಸರ್ಗಿಕ ಛಾಯಾಚಿತ್ರ."],
  ["Hindi", "एक पुराने पुस्तकालय में लकड़ी की मेज़ पर खुली हुई किताब और खिड़की से आती सुबह की रोशनी।"],
  ["Tamil", "கடற்கரையில் மாலை நேரத்தில் நடந்து செல்லும் ஒரே ஒரு சிறுமியின் இயற்கையான புகைப்படம்."],
  ["Telugu", "పచ్చని కొండల మధ్య ప్రవహించే చిన్న నది, ఉదయపు మృదువైన వెలుతురు, విశాల దృశ్యం."],
  ["Spanish", "Una fotografía realista de una bicicleta roja apoyada contra una pared amarilla, con espacio vacío a la izquierda."],
];

test("image benchmark covers multiple visual domains and languages", () => {
  assert.ok(cases.length >= 30, "benchmark should not collapse to one showcase prompt");
  const categories = new Set(cases.map(([category]) => category));
  for (const category of ["person", "animal", "product", "architecture", "composition", "typography", "diagram", "science", "3d", "Kannada", "Hindi", "Tamil", "Telugu", "Spanish"]) {
    assert.ok(categories.has(category), `missing benchmark category: ${category}`);
  }
});

for (const [category, prompt] of cases) {
  test(`preserves the user brief for ${category}: ${prompt.slice(0, 54)}`, () => {
    const result = parseImageGenerationInput({ prompt, quality: "masterpiece", steps: 8 });
    assert.equal(result.ok, true);
    assert.ok(result.prompt.includes(prompt), "the complete original brief must survive prompt direction");
    assert.ok(result.prompt.includes("Preserve the exact requested subject identity"));
    assert.ok(result.prompt.includes("Treat the user prompt as a specification"));
    assert.ok(result.width > 0 && result.height > 0);
  });
}

test("image direction distinguishes requested visual style from realism", () => {
  const prompt = "A flat vector illustration of a blue whale, simple shapes and a limited palette.";
  const directed = buildImagePrompt(prompt, "masterpiece");
  assert.ok(directed.includes(prompt));
  assert.match(directed, /requested visual style|style/i);
  assert.doesNotMatch(directed, /make every image photorealistic/i);
});

test("image generation rejects malformed and overlong briefs", () => {
  assert.equal(parseImageGenerationInput({ prompt: "" }).ok, false);
  assert.equal(parseImageGenerationInput({ prompt: "x".repeat(2049) }).ok, false);
  assert.equal(parseImageGenerationInput({ prompt: "A landscape", steps: 99 }).ok, false);
});
