"use client";

import { useMemo, useState } from "react";
import { createImageScene, renderImageSceneSvg } from "@/lib/studio/image-engine.mjs";

const PALETTE = ["#342c35", "#b9a5d4", "#e9a8c2", "#dce8c8", "#f6b98e", "#ffffff"];

export default function NativeImageStudio() {
  const [scene, setScene] = useState(() => createImageScene());
  const [selected, setSelected] = useState(2);
  const [status, setStatus] = useState("");
  const svg = useMemo(() => renderImageSceneSvg(scene), [scene]);
  const previewUrl = useMemo(() => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, [svg]);

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
      <div className="native-image-heading"><div><span>AAHANA-NATIVE CREATION ENGINE</span><h3>Image & Graphics Studio</h3><p>Compose vector artwork in your browser. No external image-generation service or account is called.</p></div><button type="button" onClick={exportSvg}>Export SVG</button></div>
      <div className="native-image-layout">
        <div className="native-image-canvas"><img src={previewUrl} alt="Live preview of your editable vector composition" /></div>
        <div className="native-image-controls">
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
      <small className="native-image-disclosure">Current capability: procedural SVG graphics, live layer editing and vector export. Neural text-to-image generation and photo editing are not yet connected.</small>
    </section>
  );
}
