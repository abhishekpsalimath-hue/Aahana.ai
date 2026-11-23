# Aahana image accuracy benchmark

Status: isolated engineering benchmark. It does not call a paid provider, change production settings, or store user images.

## Evaluation method

Run every prompt against each candidate model with the same prompt, dimensions, and seed where supported. Save outputs outside customer storage and score each result from 0–5 on:

1. Subject fidelity — requested subject and identity are recognisable.
2. Attribute fidelity — requested attributes, count, clothing, materials, and fine details are correct.
3. Composition fidelity — framing, camera angle, layout, and spatial relationships match.
4. Constraint fidelity — no forbidden additions, omissions, or substitutions.
5. Visual coherence — anatomy, geometry, lighting, and text are internally coherent.

Record the model, settings, prompt, seed, latency, provider response status, and scores. Do not describe a model as more accurate until the same test set has been run and scored. For generated text, separately record exact-text pass/fail; visual quality must not hide spelling errors.

## Test prompts

These are synthetic prompts, not user uploads. Keep them unchanged across model comparisons.

| ID | Category | Prompt | Critical checks |
|---|---|---|---|
| 01 | Portrait | A natural-light head-and-shoulders portrait of a middle-aged woman with short curly silver hair, round glasses, and a mustard sweater, looking directly at camera against a plain warm-grey wall. | Age cues, curls, glasses, sweater, direct gaze, uncluttered background |
| 02 | Portrait | A full-length studio portrait of a young man wearing a navy double-breasted suit and white sneakers, standing with both hands visible at his sides. | Full body, both hands, exact outfit, no cropped feet |
| 03 | Identity control | A realistic portrait of one elderly man with a long white beard, rectangular spectacles, and a green knitted cap; show one person only. | One person, beard, glasses, cap |
| 04 | Object count | Three red ceramic apples arranged in a straight row on a white table, with equal spacing and no other fruit. | Exactly three apples, red ceramic, row, no extra fruit |
| 05 | Object count | Five identical blue glass marbles inside a shallow transparent bowl, viewed from above. | Exactly five, blue glass, one bowl, overhead view |
| 06 | Spatial layout | A yellow bicycle leaning against the left side of a brick wall; a black helmet rests on the ground to the right of the bicycle. | Left/right placement, bicycle, helmet on ground |
| 07 | Product | A matte-black insulated water bottle with a silver screw cap, isolated on a seamless white product-photography background. | Bottle silhouette, matte finish, silver cap, no logo |
| 08 | Product | A transparent perfume bottle containing amber liquid, rectangular glass body, gold atomizer, photographed straight-on on a pale beige surface. | Transparent rectangular body, amber liquid, gold atomizer, straight-on |
| 09 | Product typography | A clean packaging mock-up with the exact label text “NORTH STAR” in uppercase, centered once on a plain white box. | Exact spelling, one label, centered |
| 10 | Typography | A minimalist poster containing exactly the words “BUILD WITH CARE” in large black uppercase letters on a cream background. | Exact phrase, uppercase, no extra text |
| 11 | Typography | A storefront sign reading exactly “MALNAD COFFEE” in white letters on a dark green signboard. | Exact spelling, legible text, no extra words |
| 12 | Architecture | A small modern single-storey house with a red tiled sloping roof, two front windows, and one centered wooden door. | One storey, roof, exactly two windows, centered door |
| 13 | Architecture | A symmetrical white classical building with six columns across the front, photographed straight-on. | Exactly six columns, symmetry, frontal view |
| 14 | Landscape | A misty green tea plantation on rolling hills at sunrise, with no buildings, roads, or people. | Tea rows, hills, sunrise mist, exclusions |
| 15 | Vehicle | A red vintage scooter parked in profile on a quiet paved street; show both wheels completely. | Side profile, two complete wheels, red scooter |
| 16 | Vehicle | A yellow city taxi viewed from the front three-quarter angle, with four visible wheels and no readable brand marks. | Correct angle, wheel geometry, no logos |
| 17 | Food | One round dosa on a stainless-steel plate with a small bowl of coconut chutney to its upper right. | One dosa, one chutney bowl, relative placement |
| 18 | Food | A glass bowl containing exactly eight green grapes, photographed close-up on a wooden table. | Exactly eight grapes, green, glass bowl |
| 19 | Devotional iconography | Lord Shiva seated in meditation, with blue-toned throat, matted hair with crescent moon and Ganga, tripundra and third eye, rudraksha beads, and trident visible. | Shiva identity, all specified attributes, no generic saint |
| 20 | Devotional iconography | Lord Hanuman in a reverent standing pose, unmistakably monkey-faced with visible muzzle, traditional ornaments, and gada. | Vanara face and muzzle, gada, no ordinary human face |
| 21 | Devotional iconography | Lord Ganesha seated on a lotus, with a clear elephant head and trunk, four arms, and traditional ornaments. | Elephant head/trunk, four arms, lotus |
| 22 | Illustration | A flat vector illustration of one orange cat sleeping curled up on a teal cushion, using only five solid colours. | One cat, curled pose, teal cushion, limited palette |
| 23 | 3D render | A stylised 3D clay render of a tiny red robot with a square head, two circular eyes, and two arms, centered on a lavender background. | Square head, two eyes, two arms, red clay style |
| 24 | Macro detail | A macro photograph of a single water droplet resting on a green leaf, with the leaf veins visible through the droplet. | One droplet, leaf veins, macro focus |
| 25 | Low light | A warmly lit reading desk at night with one brass lamp, one open book, and one cup of tea; no people. | Exact objects, warm light, no people |
| 26 | Multilingual prompt | Una bicicleta azul junto a una pared blanca; una cesta roja está en el manillar. No hay personas. | Blue bicycle, white wall, red handlebar basket, no people |
| 27 | Multilingual prompt | ಒಂದು ಹಳದಿ ಹೂದಾನಿಯಲ್ಲಿ ಮೂರು ಬಿಳಿ ಹೂಗಳು, ಸರಳ ನೀಲಿ ಹಿನ್ನೆಲೆ. | Yellow vase, exactly three white flowers, plain blue background |
| 28 | Camera/composition | A bird's-eye view of a tidy desk: laptop at top, notebook at bottom left, pen parallel to notebook, and a mug at bottom right. | Top-down view, exact object positions, pen alignment |
| 29 | Edit preservation | Starting from a supplied portrait reference, change only the background to a soft blue studio backdrop; preserve the person's face, expression, hair, clothing, pose, and crop. | Only background changes; all identity and composition preserved |
| 30 | Edit preservation | Starting from a supplied product reference, change only the surface beneath the product to light oak wood; preserve product shape, label, colour, lighting, and camera angle. | Only surface changes; product and label unchanged |

## Result sheet

For each model, record the five scores (0–5), exact-text pass/fail where relevant, latency in seconds, and any failure. Compare average scores by dimension and prompt category, not only one overall average. Keep failed outputs in the report so regressions are visible.

## Current candidate routing

- Default remains FLUX.1 Schnell.
- FLUX.2 Klein 4B remains available through the existing explicit `AAHANA_IMAGE_MODEL=flux-2-klein-4b` setting.
- FLUX.2 Dev is now wired as an opt-in candidate through `AAHANA_IMAGE_MODEL=flux-2-dev`. This branch does not change Vercel environment variables or production routing.
- The provider request uses 1024×1024, 25 steps, and guidance 4. Confirm current account access, provider behaviour, latency, and usage cost before enabling it in any shared environment.

No model is declared the winner until real outputs have been generated and scored on this same benchmark.
