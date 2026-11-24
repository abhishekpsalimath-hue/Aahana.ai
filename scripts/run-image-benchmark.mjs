import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { parseImageGenerationInput } from "../src/lib/creative/image-generation.mjs";
import {
  resolveImageModel,
  buildImageProviderRequest,
  detectImageMimeTypeFromBase64,
} from "../src/lib/creative/image-provider.mjs";

const CASES = Object.freeze([
  { id: "portrait-01", category: "people", prompt: "Photorealistic editorial portrait of an elderly Indian woman with silver hair in a simple indigo cotton sari, warm natural window light, direct gaze, shoulders-up framing, uncluttered neutral background." },
  { id: "product-01", category: "products", prompt: "Premium studio product photograph of one matte cobalt-blue insulated water bottle, centered upright, subtle condensation, softbox reflections, clean warm-white seamless background, no logo and no text." },
  { id: "animal-01", category: "animals", prompt: "Wildlife photograph of one Bengal tiger walking left to right through lush monsoon forest, full body visible, natural anatomy, dappled daylight, realistic fur detail." },
  { id: "landscape-01", category: "landscapes", prompt: "Wide cinematic landscape photograph of the Western Ghats in Karnataka after monsoon rain, layered green mountains, low drifting mist, small winding river in foreground, natural overcast light, no buildings." },
  { id: "architecture-01", category: "architecture", prompt: "Architectural visualization of a contemporary South Indian courtyard home, laterite stone, timber screens, central rain tree, single-storey composition, late afternoon sunlight, realistic materials." },
  { id: "food-01", category: "food", prompt: "High-end food photography of one traditional Karnataka masala dosa on a round steel plate with a small bowl of coconut chutney and sambar, three-quarter overhead angle, appetizing natural light." },
  { id: "sacred-01", category: "sacred", prompt: "Respectful traditional devotional painting of Ardhanarishvara as one unified divine figure with one face and one continuous body, Parvati on the viewer's left and Shiva on the viewer's right, balanced symmetrical standing pose, ornate classical Indian temple jewelry, detailed traditional textile patterns, luminous temple backdrop." },
  { id: "illustration-01", category: "illustration", prompt: "Whimsical storybook illustration of a tiny astronaut tending a glowing garden on a small asteroid, expressive hand-painted details, deep violet space, gentle starlight, charming but anatomically coherent character." },
  { id: "3d-01", category: "3d", prompt: "High-end 3D render of a translucent lilac glass-free crystal sphere floating above a dark matte pedestal, physically based materials, crisp studio rim lighting, subtle particles, premium product visualization." },
  { id: "composition-01", category: "composition", prompt: "Editorial still life with exactly three objects arranged left to right: a closed cream notebook, a single yellow pencil, and one small terracotta cup; overhead view, pale lavender tabletop, soft morning shadows, no extra objects." },
]);

const MAX_CASES = 10;
if (CASES.length !== MAX_CASES || CASES.length > 10) throw new Error("Benchmark case cap violated.");
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
if (!accountId || !apiToken) throw new Error("Required Cloudflare credentials are not configured as repository secrets.");

const model = resolveImageModel(process.env.AAHANA_IMAGE_MODEL);
const outputDir = resolve("artifacts/aahana-image-benchmark");
await mkdir(outputDir, { recursive: true });
const manifest = {
  benchmark: "Aahana controlled synthetic image benchmark",
  model,
  provider: "Cloudflare Workers AI",
  caseCount: CASES.length,
  generatedAt: new Date().toISOString(),
  outputs: [],
};

for (const item of CASES) {
  const parsed = parseImageGenerationInput({ prompt: item.prompt, aspectRatio: item.id === "landscape-01" ? "16:9" : "1:1" });
  if (!parsed.ok) throw new Error(`Invalid fixed benchmark case: ${item.id}`);
  const requestOptions = buildImageProviderRequest({
    model,
    prompt: parsed.prompt,
    steps: parsed.steps,
    width: parsed.width,
    height: parsed.height,
  });
  const started = performance.now();
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`,
    {
      ...requestOptions,
      headers: { ...requestOptions.headers, Authorization: `Bearer ${apiToken}` },
    },
  );
  const elapsedSeconds = Number(((performance.now() - started) / 1000).toFixed(2));
  const payload = await response.json().catch(() => null);
  const base64 = payload?.result?.image;
  const mime = detectImageMimeTypeFromBase64(base64);
  if (!response.ok || !mime) {
    // Do not print provider response bodies; they may contain sensitive diagnostics.
    throw new Error(`Provider failed for ${item.id} (HTTP ${response.status}); no image saved.`);
  }
  const extension = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const file = `${item.id}.${extension}`;
  await writeFile(resolve(outputDir, file), Buffer.from(base64, "base64"), { flag: "wx" });
  manifest.outputs.push({
    caseId: item.id,
    category: item.category,
    file,
    mimeType: mime,
    width: parsed.width,
    height: parsed.height,
    latencySeconds: elapsedSeconds,
  });
  console.log(`Completed ${item.id} (${manifest.outputs.length}/${MAX_CASES}) in ${elapsedSeconds}s`);
}
await writeFile(resolve(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2), { flag: "wx" });
console.log(`Saved ${manifest.outputs.length} synthetic images and manifest.`);
