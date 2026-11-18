"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createImageScene, renderImageSceneSvg, buildPinterestInspiredPrompt } from "@/lib/studio/image-engine.mjs";
import { COLOR_GRADES, getColorGradeFilter } from "@/lib/studio/color-grading.mjs";
import { applyCubeLutToImageData, parseCubeLut } from "@/lib/studio/cube-lut.mjs";
import { prepareImageForEditing } from "@/lib/studio/image-edit.mjs";

const PALETTE = ["#342c35", "#b9a5d4", "#e9a8c2", "#dce8c8", "#f6b98e", "#ffffff"];

export default function NativeImageStudio() {
  const [scene, setScene] = useState(() => createImageScene());
  const [selected, setSelected] = useState(2);
  const [status, setStatus] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [visualNotes, setVisualNotes] = useState("");
  const [visualStyle, setVisualStyle] = useState("editorial");
  const [colorGrade, setColorGrade] = useState("none");
  const [cubeLut, setCubeLut] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editStyle, setEditStyle] = useState("cartoon");
  const [editChange, setEditChange] = useState("");
  const [editPreserve, setEditPreserve] = useState("Keep the same person, face, age, pose and framing.");
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState("");
  const [referenceImage, setReferenceImage] = useState(null);
  const [referencePreview, setReferencePreview] = useState("");
  const editInFlightRef = useRef(false);
  const editAttemptRef = useRef(0);
  const svg = useMemo(() => renderImageSceneSvg(scene, colorGrade), [scene, colorGrade]);
  const gradeFilter = getColorGradeFilter(colorGrade);
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
    setGeneratedImage("");
    setStatus("Photo loaded locally. It will only be sent for editing when you press Transform my photo.");
  }

  const safePinterestUrl = (() => { try { const url = new URL(referenceUrl); return ["pinterest.com", "www.pinterest.com", "pin.it"].includes(url.hostname) && url.protocol === "https:" ? url.href : ""; } catch { return ""; } })();

  async function loadCubeLut(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".cube") || file.size > 2 * 1024 * 1024) {
      setStatus("Choose a .cube 3D LUT file smaller than 2 MB.");
      return;
    }
    try {
      const parsed = parseCubeLut(await file.text());
      if (!parsed) throw new Error("This .cube file is invalid or uses an unsupported LUT format. A 3D LUT with 2–64 points per axis is required.");
      setCubeLut({ ...parsed, name: file.name });
      setStatus(`Loaded ${file.name} (${parsed.size}³ 3D LUT). It will be applied to generated-image exports.`);
    } catch (error) { setStatus(error?.message || "Could not read this LUT file."); }
  }

  async function transformReferenceImage() {
    if (!referenceImage || editInFlightRef.current || generating) return;
    editInFlightRef.current = true;
    const attempt = ++editAttemptRef.current;
    const sourceFile = referenceImage;
    const requestedStyle = editStyle;
    const changeRequest = editChange;
    const preserveRequest = editPreserve;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    setEditing(true);
    setStatus("Transforming your uploaded photo. Your original remains available for another attempt…");
    try {
      const prepared = await prepareImageForEditing(sourceFile);
      const response = await fetch("/api/images/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...prepared, style: requestedStyle, changeRequest, preserveRequest }),
        signal: controller.signal,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.imageDataUrl) throw new Error(result.error || "Photo transformation is unavailable right now.");
      if (attempt !== editAttemptRef.current) return;
      setGeneratedImage(result.imageDataUrl);
      setStatus("Photo transformed. Your original upload is still preserved and can be used for another style or retry.");
    } catch (error) {
      if (attempt === editAttemptRef.current) {
        const message = error?.name === "AbortError"
          ? "The transformation took too long. Your original photo is safe—try again."
          : error?.message || "Could not transform this photo. Your original upload is safe—try again.";
        setStatus(message);
      }
    } finally {
      clearTimeout(timeout);
      if (attempt === editAttemptRef.current) {
        editInFlightRef.current = false;
        setEditing(false);
      }
    }
  }

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
      setStatus("Original image generated from your written direction. The Pinterest link and uploaded photo were not sent to the text-to-image provider.");
    } catch (error) {
      setStatus(error?.message || "Image generation failed. Your editable vector composition is still available.");
    } finally { setGenerating(false); }
  }

  async function exportGeneratedImage() {
    if (!generatedImage) return;
    try {
      const image = new Image();
      image.src = generatedImage;
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image export canvas is unavailable.");
      context.filter = cubeLut ? "none" : gradeFilter;
      context.drawImage(image, 0, 0);
      context.filter = "none";
      if (cubeLut) {
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        applyCubeLutToImageData(pixels, cubeLut);
        context.putImageData(pixels, 0, 0);
      }
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("The graded image could not be encoded.");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "aahana-graded-image.png"; anchor.click();
      URL.revokeObjectURL(url);
      setStatus(cubeLut ? `Generated image exported with ${cubeLut.name}.` : "Generated image exported with the selected colour grade.");
    } catch (error) {
      setStatus(error?.message || "Could not export the graded image.");
    }
  }

  function exportSvg() {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "aahana-creation.svg";
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus(`SVG exported with ${COLOR_GRADES.find((grade) => grade.id === colorGrade)?.label || "Original"} grade. This is an editable vector graphic, not an AI-generated photograph.`);
  }

  const active = scene.layers[selected];
  return (
    <section className="native-image-studio" aria-label="Aahana native image studio">
      <div className="native-image-heading"><div><span>AAHANA CREATIVE ENGINE</span><h3>Image & Graphics Studio</h3><p>Build editable graphics or generate original artwork from a visual direction.</p></div><button type="button" onClick={exportSvg}>Export SVG</button></div>
      <div className="native-image-layout">
        <div className="native-image-canvas"><img src={generatedImage || previewUrl} style={{ filter: generatedImage ? gradeFilter : "none" }} alt={generatedImage ? "AI-generated or image-edited result" : "Live preview of your editable vector composition"} /></div>
        <div className="native-image-controls">
          <div className="native-image-inspiration"><strong>Pinterest inspiration</strong><label>Reference link (optional)<input type="url" value={referenceUrl} onChange={(event) => setReferenceUrl(event.target.value)} placeholder="Paste a Pinterest pin URL" /></label>{safePinterestUrl && <a href={safePinterestUrl} target="_blank" rel="noopener noreferrer">Open Pinterest reference</a>}{referenceUrl && !safePinterestUrl && <small>Enter a valid HTTPS Pinterest or pin.it link.</small>}<label>Upload your photo<input type="file" accept="image/png,image/jpeg,image/webp" disabled={editing} onChange={(event) => { chooseReferenceImage(event.target.files?.[0]); event.target.value = ""; }} /></label>{referencePreview && <div className="native-image-reference-preview"><img src={referencePreview} alt="Your original photo, kept unchanged" /><button type="button" disabled={editing} onClick={() => { setReferenceImage(null); setGeneratedImage(""); }}>Remove photo</button></div>}{referencePreview && generatedImage && <div className="native-image-before-after" aria-label="Before and after photo comparison"><figure><img src={referencePreview} alt="Original uploaded photo" /><figcaption>Original photo</figcaption></figure><figure><img src={generatedImage} alt="Transformed photo" /><figcaption>Transformed result</figcaption></figure></div>}<div className="native-image-edit-panel"><strong>Transform your actual photo</strong><p>Keep the same person, face, pose and scene. Change only the artistic treatment.</p><label>What should change?<textarea value={editChange} onChange={(event) => setEditChange(event.target.value)} maxLength={400} placeholder="Example: turn the whole scene into a hand-drawn cartoon, keep the same background." /></label><label>What must stay the same?<textarea value={editPreserve} onChange={(event) => setEditPreserve(event.target.value)} maxLength={400} /></label><label>Transformation style<select value={editStyle} onChange={(event) => setEditStyle(event.target.value)}><option value="cartoon">Full-frame cartoon illustration</option><option value="anime">Anime illustration</option><option value="comic">Comic-book art</option><option value="3d-animation">3D animated-film look</option><option value="watercolor">Watercolour painting</option></select></label><button type="button" onClick={transformReferenceImage} disabled={!referenceImage || editing || generating}>{editing ? "Transforming photo…" : "Transform my photo"}</button><small>Uses image-to-image editing. It is not the same as generating a new cartoon character or sticker. The photo is resized to a maximum 512px input for the editor and sent only when you press the button. Each edit may incur Cloudflare Workers AI usage charges.</small></div><label>Creative direction<select value={visualStyle} onChange={(event) => setVisualStyle(event.target.value)}><option value="editorial">Editorial & premium</option><option value="education">Education & learning</option><option value="cinematic">Cinematic & dramatic</option><option value="minimal">Minimal & clean</option><option value="playful">Playful illustration</option><option value="product">Product & brand campaign</option><option value="social">Social media poster</option></select></label><label>What do you like about it?<textarea value={visualNotes} onChange={(event) => setVisualNotes(event.target.value)} maxLength={1200} placeholder="Describe colours, layout, typography, lighting, mood and subject. Aahana creates an original design from these notes." /></label><button type="button" onClick={generateInspiredImage} disabled={generating || editing || !visualNotes.trim()}>{generating ? "Creating…" : "Generate original image"}</button><small>The current image model receives only your written direction. Links and uploaded images stay in this browser and are not visually analysed yet. Use references you have permission to use.</small>{generatedImage && <button type="button" onClick={exportGeneratedImage}>Export generated image</button>}</div>
          <label>Colour grade<select value={colorGrade} onChange={(event) => setColorGrade(event.target.value)}>{COLOR_GRADES.map((grade) => <option key={grade.id} value={grade.id}>{grade.label}</option>)}</select></label>
          <label>Import 3D LUT (.cube)<input type="file" accept=".cube,text/plain" onChange={(event) => loadCubeLut(event.target.files?.[0])} /></label>
          {cubeLut && <div className="native-image-lut-status"><span>{cubeLut.name} · {cubeLut.size}³</span><button type="button" onClick={() => { setCubeLut(null); setStatus("Custom LUT removed."); }}>Remove LUT</button></div>}
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
      <small className="native-image-disclosure">Current capabilities: editable SVG composition, 33 filter-based looks, custom 3D .cube LUT import for generated-image PNG export, and an optional provider-backed original image request. Custom LUTs use trilinear interpolation and require a 3D LUT with 2–64 points per axis. Generation requires private Cloudflare Workers AI credentials; Pinterest links can be opened and reference images preview locally; automated visual analysis and direct Pinterest import are not connected.</small>
    </section>
  );
}
