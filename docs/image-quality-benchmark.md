# Aahana image-quality benchmark

This is a multi-case regression suite, not a single showcase image. It covers people, hands, animals, products, architecture, landscapes, spatial composition, exact text, diagrams, science, food, fashion, vehicles, interiors, illustration, 3D, cinematic scenes and regional-language prompts.

## Evaluation protocol

For every generated case, review the actual output against the original prompt. Score each dimension from 0 to 5:

1. **Subject fidelity** — correct subject, identity, count and defining attributes.
2. **Composition fidelity** — requested framing, orientation, left/right placement, scale and negative space.
3. **Detail and anatomy** — coherent faces, hands, geometry, product features, labels and object boundaries.
4. **Style and material fidelity** — follows the requested medium, lighting, texture and material rather than imposing a generic look.
5. **Text and factual fidelity** — exact requested wording, diagram labels and scientifically plausible relationships.

Record the model ID, provider response status, prompt, seed (when supported), aspect ratio, latency and scores. Compare model versions on the same cases and seeds where the provider supports deterministic seeds. Do not report a quality percentage from a small sample or from prompt validation alone.

## Release gate

- Run the complete case set, not a cherry-picked image.
- Keep generated outputs and reviewer scores for every case.
- Compare against the previous model/configuration using the same cases.
- Report per-category results and the failure examples, not only an average.
- Do not change the production image model or spend provider credits as part of the offline test suite. A paid/live benchmark must be explicitly enabled and cost-reviewed first.

The automated Node test checks that all briefs survive prompt construction and that coverage stays broad. It does **not** claim to measure visual quality; only reviewed generated outputs can establish that.
