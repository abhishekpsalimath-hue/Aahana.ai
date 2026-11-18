"use client";

import { useEffect, useMemo, useState } from "react";
import { createImageScene, renderImageSceneSvg, buildPinterestInspiredPrompt } from "@/lib/studio/image-engine.mjs";

const PALETTE = ["#342c35", "#b9a5d4", "#e9a8c2", "#dce8c8", "#f6b98e", "#ffffff"];

export default function NativeImageStudio() {
  const [scene, setScene] = useState(() => createImageScene());
  const [selected, setSelected] = useState(2);
  const [status, setStatus] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [visualNotes, setVisualNotes] = useState("");
  const [visualStyle, setVisualStyle] = useState("editorial");
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState("");
  const [referenceImage, setReferenceImage] = useState(null);
  const [referencePreview, setReferencePreview] = useState("");
  const svg = useMemo(() => renderImageSceneSvg(scene), [scene]);
  const previewUrl = useMemo(() => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, [svg]);
  useEffect(() => {
    if (!referenceImage) { setReferencePreview(""); return; }
    const url = URL.createObjectURL(referenceImage);
    setReferencePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [referenceImage]);

  function updateLayer(index, patch) {
    setScene((current) => ({ ...current, layers: current.layers.map((layer, i) => i === index ? { ...layer, ...patch } : layer) }));
  }
  function addLayer(type) {
    const layer = type === "text"
      ? { type, x: 80, y: 570, size: 38, weight: 700, fill: "#342c35", stroke: "none", text: "Your idea starts here", anchor: "start" }
      : type === "circle"
        ? { type, cx: 950, cy: 520, radius: 65, fill: "#dce8c8", stroke: "none" }
        : { type, x: 760, y: 480, width: 260, height: 90, radius: 18, fill: "#f6b98e", stroke: "none" };
    setScene((current) => ({ ...current, layers: [...current.layers, layer] }));
    setSelected(scene.layers.length);
    setStatus("Layer added to your composition.");
  }
  function chooseReferenceImage(file) {
    if (!file) { setReferenceImage(null); return; }
    if (!/^image\\/(png|jpeg|webp)$/.test(file.type) || file.size > 8 * 1024 * 1024) {
      setStatus("Choose a PNG, JPEG or WebP image smaller than 8 MB.");
      return;
    }
    setReferenceImage(file);
    setStatus("Reference image loaded locally. Aahana has not uploaded or analysed it.");
  }

  const safePinterestUrl = (() => { try { const url = new URL(referenceUrl); return ["pinterest.com", "www.pinterest.com", "pin.it"].includes(url.hostname) && url.protocol === "https:" ? url.href : ""; } catch { return ""; } })();

  async function generateInspiredImage() {
    const prompt = buildPinterestInspiredPrompt({ title: scene.layers.find((layer) => layer.type === "text")?.text || "Original creative", notes: visualNotes, style: visualStyle });
    if (!prompt) { setStatus("Describe the visual direction you want Aahana to create."); return; }
    setGenerating(true);
    setStatus("Generating an original image from your written art direction…");
    try {
      const response = await fetch("/api/images/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.imageDataUrl) throw new Error(result.error || "Image generation is not available right now.");
      setGeneratedImage(result.imageDataUrl);
      setStatus("Original image generated from your written direction. The Pinterest link and uploaded reference image were not sent to the image provider.");
    } catch (error) {
      setStatus(error?.message || "Image generation failed. Your editable vector composition is still available.");
    } finally { setGenerating(false); }
  }

  function exportGeneratedImage() {
    if (!generatedImage) return;
    const anchor = document.createElement("a"); anchor.href = generatedImage; anchor.download = "aahana-original-image.jpg"; anchor.click();
  }

  function exportSvg() {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "aahana-creation.svg";
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("SVG exported. This is an editable vector graphic, not an AI-generated photograph.");
  }

  const active = scene.layers[selected];
  return (
    <section className="native-image-studio" aria-label="Aahana native image studio">
      <div className="native-image-heading"><div><span>AAHANA CREATIVE ENGINE</span><h3>Image & Graphics Studio</h3><p>Build editable graphics or generate original artwork from a visual direction.</p></div><button type="button" onClick={exportSvg}>Export SVG</button></div>
      <div className="native-image-layout">
        <div className="native-image-canvas"><img src={generatedImage || previewUrl} alt={generatedImage ? "AI-generated original image inspired by your written visual direction" : "Live preview of your editable vector composition"} /></div>
        <div className="native-image-controls">
          <div className="native-image-inspiration"><strong>Pinterest inspiration</strong><label>Reference link (optional)<input type="url" value={referenceUrl} onChange={(event) => setReferenceUrl(event.target.value)} placeholder="Paste a Pinterest pin URL" /></label>{safePinterestUrl && <a href={safePinterestUrl} target="_blank" rel="noopener noreferrer">Open Pinterest reference</a>}{referenceUrl && !safePinterestUrl && <small>Enter a valid HTTPS Pinterest or pin.it link.</small>}<label>Upload a reference image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => chooseReferenceImage(event.target.files?.[0])} /></label>{referencePreview && <div className="native-image-reference-preview"><img src={referencePreview} alt="Your locally selected visual reference" /><button type="button" onClick={() => setReferenceImage(null)}>Remove reference</button></div>}<label>Creative direction<select value={visualStyle} onChange={(event) => setVisualStyle(event.target.value)}><option value="editorial">Editorial & premium</option><option value="education">Education & learning</option><option value="cinematic">Cinematic & dramatic</option><option value="minimal">Minimal & clean</option><option value="playful">Playful illustration</option><option value="product">Product & brand campaign</option><option value="social">Social media poster</option></select></label><label>What do you like about it?<textarea value={visualNotes} onChange={(event) => setVisualNotes(event.target.value)} maxLength={1200} placeholder="Describe colours, layout, typography, lighting, mood and subject. Aahana creates an original design from these notes." /></label><button type="button" onClick={generateInspiredImage} disabled={generating || !visualNotes.trim()}>{generating ? "Creating…" : "Generate original image"}</button><small>The current image model receives only your written direction. Links and uploaded images stay in this browser and are not visually analysed yet. Use references you have permission to use.</small>{generatedImage && <button type="button" onClick={exportGeneratedImage}>Export generated image</button>}</div>
          <label>Canvas background<input type="color" value={scene.background} onChange={(event) => setScene((current) => ({ ...current, background: event.target.value }))} /></label>
          <div className="native-image-add"><button type="button" onClick={() => addLayer("text")}>+ Text</button><button type="button" onClick={() => addLayer("circle")}>+ Circle</button><button type="button" onClick={() => addLayer("rect")}>+ Shape</button></div>
          <strong>Layers · {scene.layers.length}/100</strong>
          <div className="native-image-layer-list">{scene.layers.map((layer, index) => <button type="button" key={index} className={selected === index ? "is-selected" : ""} onClick={() => setSelected(index)}>{layer.type === "text" ? layer.text || "Text layer" : `${layer.type} layer ${index + 1}`}</button>)}</div>
          {active && <div className="native-image-layer-edit">
            <label>Layer colour<div className="native-image-palette">{PALETTE.map((color) => <button type="button" key={color} aria-label={`Set colour ${color}`} style={{ background: color }} onClick={() => updateLayer(selected, { fill: color })} />)}<input aria-label="Custom layer colour" type="color" value={active.fill === "none" ? "#ffffff" : active.fill} onChange={(event) => updateLayer(selected, { fill: event.target.value })} /></div></label>
            {active.type === "text" && <><label>Text<input value={active.text} maxLength={500} onChange={(event) => updateLayer(selected, { text: event.target.value })} /></label><label>Text size<input type="range" min="12" max="120" value={active.size} onChange={(event) => updateLayer(selected, { size: Number(event.target.value) })} /></label></>}
            {active.type === "circle" && <label>Radius<input type="range" min="8" max="280" value={active.radius} onChange={(event) => updateLayer(selected, { radius: Number(event.target.value) })} /></label>}
            {active.type === "rect" && <label>Corner radius<input type="range" min="0" max="100" value={active.radius} onChange={(event) => updateLayer(selected, { radius: Number(event.target.value) })} /></label>}
            <button className="native-image-remove" type="button" onClick={() => { setScene((current) => ({ ...current, layers: current.layers.filter((_, i) => i !== selected) })); setSelected(Math.max(0, selected - 1)); }}>Remove selected layer</button>
          </div>}
          {status && <p role="status">{status}</p>}
        </div>
      </div>
      <small className="native-image-disclosure">Current capabilities: editable SVG composition and an optional provider-backed original image request. Generation requires private Cloudflare Workers AI credentials; Pinterest links can be opened and reference images preview locally; automated visual analysis and direct Pinterest import are not connected.</small>
    </section>
  );
}
