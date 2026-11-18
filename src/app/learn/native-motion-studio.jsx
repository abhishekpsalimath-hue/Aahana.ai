"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createMotionTimeline, sampleMotionTimeline, validateMotionTimeline } from "@/lib/studio/motion-engine.mjs";

const STARTER = {
  ...createMotionTimeline(5000, 30),
  tracks: [{
    id: "hero-orbit",
    layerIndex: 0,
    property: "cx",
    keyframes: [
      { time: 0, value: 180, easing: "ease-in-out" },
      { time: 2500, value: 850, easing: "ease-in-out" },
      { time: 5000, value: 180, easing: "linear" },
    ],
  }],
};

export default function NativeMotionStudio() {
  const [timeline, setTimeline] = useState(STARTER);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState("");
  const [exporting, setExporting] = useState(false);
  const exportCanvasRef = useRef(null);
  const sampled = useMemo(() => sampleMotionTimeline(timeline, time), [timeline, time]);
  const animatedValue = (property, fallback) => sampled.find((item) => item.property === property)?.value ?? fallback;
  const x = animatedValue("cx", 180);
  const y = animatedValue("cy", 180);
  const radius = animatedValue("radius", 64);
  const opacity = animatedValue("opacity", 1);

  useEffect(() => {
    if (!playing) return undefined;
    const startedAt = Date.now() - time;
    const timer = window.setInterval(() => {
      const next = Date.now() - startedAt;
      if (next >= timeline.duration) {
        setTime(timeline.duration);
        setPlaying(false);
      } else setTime(next);
    }, 33);
    return () => window.clearInterval(timer);
  }, [playing, timeline.duration]);

  function updateKeyframe(trackIndex, frameIndexToUpdate, patch) {
    setTimeline((current) => ({
      ...current,
      tracks: current.tracks.map((track, index) => {
        if (index !== trackIndex) return track;
        const keyframes = track.keyframes.map((frame, frameIndex) => {
          if (frameIndex !== frameIndexToUpdate) return frame;
          const next = { ...frame, ...patch };
          if (patch.time !== undefined) {
            const lower = frameIndex > 0 ? track.keyframes[frameIndex - 1].time + 1 : 0;
            const upper = frameIndex < track.keyframes.length - 1 ? track.keyframes[frameIndex + 1].time - 1 : current.duration;
            next.time = Math.max(lower, Math.min(upper, Number(patch.time) || 0));
          }
          return next;
        });
        return { ...track, keyframes };
      }),
    }));
    setStatus("Motion keyframe updated.");
  }

  function addTrack(property) {
    if (timeline.tracks.length >= 8 || timeline.tracks.some((track) => track.property === property)) return;
    const ranges = { cy: [120, 240], radius: [52, 96], opacity: [1, 0.35] };
    const [from, to] = ranges[property] || [0, 100];
    const track = { id: `layer-${property}-${Date.now()}`, layerIndex: 0, property, keyframes: [
      { time: 0, value: from, easing: "ease-in-out" },
      { time: timeline.duration, value: to, easing: "ease-in-out" },
    ] };
    setTimeline((current) => ({ ...current, tracks: [...current.tracks, track] }));
    setStatus(`Added animated ${property} track.`);
  }

  function removeTrack(trackIndex) {
    if (trackIndex === 0) return;
    setTimeline((current) => ({ ...current, tracks: current.tracks.filter((_, index) => index !== trackIndex) }));
    setStatus("Animation track removed.");
  }

  function addKeyframe(trackIndex) {
    const frames = timeline.tracks[trackIndex]?.keyframes || [];
    if (frames.length >= 20) return;
    let gapIndex = 0;
    let largestGap = 0;
    for (let index = 0; index < frames.length - 1; index += 1) {
      const gap = frames[index + 1].time - frames[index].time;
      if (gap > largestGap) { largestGap = gap; gapIndex = index; }
    }
    if (largestGap < 2) return;
    const left = frames[gapIndex];
    const right = frames[gapIndex + 1];
    const midpoint = Math.floor((left.time + right.time) / 2);
    const value = Math.round(((left.value + right.value) / 2) * 100) / 100;
    setTimeline((current) => ({ ...current, tracks: current.tracks.map((track, index) => index === trackIndex
      ? { ...track, keyframes: [...track.keyframes, { time: midpoint, value, easing: "ease-in-out" }].sort((a, b) => a.time - b.time) }
      : track) }));
    setStatus("A midpoint keyframe was added.");
  }

  async function exportWebM() {
    if (exporting) return;
    if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
      setStatus("WebM export is not supported by this browser. Export the timeline JSON instead.");
      return;
    }
    const valid = validateMotionTimeline(timeline);
    if (!valid) { setStatus("Timeline validation failed. Review keyframe times."); return; }
    setExporting(true);
    setStatus("Rendering your animation to a local WebM video…");
    const canvas = exportCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) { setExporting(false); setStatus("The video canvas could not be created."); return; }
    const stream = canvas.captureStream(valid.fps);
    const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type));
    let recorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setExporting(false);
      setStatus("This browser could not start WebM recording. Export the timeline JSON instead.");
      return;
    }
    const chunks = [];
    recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
    recorder.onerror = () => {
      stream.getTracks().forEach((track) => track.stop());
      setExporting(false);
      setStatus("Video recording failed. Your editable timeline is unchanged.");
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
      if (blob.size) {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "aahana-motion-preview.webm";
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        setStatus("WebM video exported locally. No paid generation provider was used.");
      } else setStatus("The browser returned an empty video. Try again or export the timeline JSON.");
      setExporting(false);
    };
    const drawFrame = (frameTime) => {
      const values = sampleMotionTimeline(valid, frameTime);
      const value = (property, fallback) => values.find((item) => item.property === property)?.value ?? fallback;
      const x = value("cx", 180) / 1000 * canvas.width;
      const y = value("cy", 180) / 360 * canvas.height;
      const orbRadius = value("radius", 64) / 360 * canvas.height;
      const orbOpacity = Math.max(0, Math.min(1, value("opacity", 1)));
      const background = context.createLinearGradient(0, 0, canvas.width, canvas.height);
      background.addColorStop(0, "#282038");
      background.addColorStop(1, "#171421");
      context.fillStyle = background;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.strokeStyle = "#79678f";
      context.lineWidth = 2;
      context.setLineDash([7, 12]);
      context.beginPath(); context.moveTo(70, canvas.height * .79); context.lineTo(canvas.width - 70, canvas.height * .79); context.stroke();
      context.setLineDash([]);
      const orb = context.createRadialGradient(x - orbRadius * .3, y - orbRadius * .35, 5, x, y, orbRadius);
      orb.addColorStop(0, "#f4eafa"); orb.addColorStop(.45, "#c7a8ed"); orb.addColorStop(1, "#8064ae");
      context.globalAlpha = orbOpacity; context.fillStyle = orb; context.beginPath(); context.arc(x, y, orbRadius, 0, Math.PI * 2); context.fill();
      context.fillStyle = "rgba(255,255,255,.28)"; context.beginPath(); context.arc(x - orbRadius * .38, y - orbRadius * .4, Math.max(5, orbRadius * .18), 0, Math.PI * 2); context.fill();
      context.globalAlpha = 1;
      context.fillStyle = "#eee5fa"; context.font = "bold 26px system-ui"; context.fillText("Aahana Motion Preview", 70, 75);
      context.fillStyle = "#b8a9c9"; context.font = "16px system-ui"; context.fillText("Original keyframed animation", 70, 108);
    };
    try {
      drawFrame(0);
      recorder.start(200);
      const startedAt = performance.now();
      const tick = (now) => {
        const elapsed = Math.min(valid.duration, now - startedAt);
        drawFrame(elapsed);
        if (elapsed >= valid.duration) recorder.stop();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch {
      if (recorder.state !== "inactive") recorder.stop();
      else { stream.getTracks().forEach((track) => track.stop()); setExporting(false); }
      setStatus("Video rendering could not start. Your timeline remains available.");
    }
  }

  function exportTimeline() {
    const valid = validateMotionTimeline(timeline);
    if (!valid) { setStatus("Timeline validation failed. Review keyframe times."); return; }
    const blob = new Blob([JSON.stringify(valid, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "aahana-motion-timeline.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("Editable motion timeline exported as JSON.");
  }

  return (
    <section className="native-motion-studio" aria-label="Aahana native motion studio">
      <div className="native-motion-heading"><div><span>AAHANA-NATIVE MOTION ENGINE</span><h3>Motion & Animation Studio</h3><p>Build keyframed movement and preview it live, locally in your browser.</p></div><div className="native-motion-export-actions"><button type="button" onClick={exportWebM} disabled={exporting}>{exporting ? "Rendering video…" : "Export WebM video"}</button><button type="button" onClick={exportTimeline}>Export timeline</button></div></div>
      <canvas ref={exportCanvasRef} width="1280" height="720" hidden aria-hidden="true" />\n      <div className="native-motion-stage">
        <svg viewBox="0 0 1000 360" role="img" aria-label="Animated preview of a lavender sphere moving across a stage">
          <defs><linearGradient id="aahana-motion-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#282038"/><stop offset="1" stopColor="#171421"/></linearGradient><radialGradient id="aahana-motion-ball"><stop offset="0" stopColor="#f4eafa"/><stop offset=".45" stopColor="#c7a8ed"/><stop offset="1" stopColor="#8064ae"/></radialGradient></defs>
          <rect width="1000" height="360" rx="16" fill="url(#aahana-motion-bg)"/>
          <path d="M70 285H930" stroke="#79678f" strokeWidth="2" strokeDasharray="5 9"/>
          <circle cx={x} cy={y} r={radius} fill="url(#aahana-motion-ball)" opacity={opacity}/>
          <circle cx={x - radius * .31} cy={y - radius * .36} r={Math.max(4, radius * .18)} fill="#fff" opacity={opacity * .28}/>
          <text x="70" y="65" fill="#eee5fa" fontSize="20" fontFamily="system-ui">Aahana Motion Preview</text>
          <text x="70" y="95" fill="#b8a9c9" fontSize="12" fontFamily="system-ui">Keyframed position · smooth interpolation</text>
        </svg>
      </div>
      <div className="native-motion-transport">
        <button type="button" onClick={() => { if (time >= timeline.duration) setTime(0); setPlaying((value) => !value); }}>{playing ? "Pause" : "Play preview"}</button>
        <button type="button" onClick={() => { setPlaying(false); setTime(0); }}>Reset</button>
        <label>Playhead <input type="range" min="0" max={timeline.duration} step="10" value={time} onChange={(event) => { setPlaying(false); setTime(Number(event.target.value)); }} /></label>
        <output>{(time / 1000).toFixed(2)}s / {(timeline.duration / 1000).toFixed(2)}s</output>
      </div>
      <div className="native-motion-timeline">
        <div className="native-motion-track-title"><strong>Animation tracks</strong><div className="native-motion-track-add">{[{ property: "cy", label: "+ Y position" }, { property: "radius", label: "+ Scale" }, { property: "opacity", label: "+ Fade" }].map((item) => <button type="button" key={item.property} onClick={() => addTrack(item.property)} disabled={timeline.tracks.length >= 8 || timeline.tracks.some((track) => track.property === item.property)}>{item.label}</button>)}</div></div>
        <div className="native-motion-ruler"><span>0s</span><span>{(timeline.duration / 2000).toFixed(1)}s</span><span>{(timeline.duration / 1000).toFixed(1)}s</span></div>
        {timeline.tracks.map((track, trackIndex) => (
          <div className="native-motion-track-group" key={track.id}>
            <div className="native-motion-track-label"><strong>{track.property === "cx" ? "Position · X" : track.property === "cy" ? "Position · Y" : track.property === "radius" ? "Scale · Radius" : "Opacity"}</strong><div><button type="button" onClick={() => addKeyframe(trackIndex)} disabled={track.keyframes.length >= 20}>+ Keyframe</button>{trackIndex > 0 && <button type="button" onClick={() => removeTrack(trackIndex)}>Remove track</button>}</div></div>
            <div className="native-motion-track">{track.keyframes.map((frame, index) => <button type="button" key={index} className={Math.abs(time - frame.time) < 80 ? "active" : ""} style={{ left: `${frame.time / timeline.duration * 100}%` }} onClick={() => { setPlaying(false); setTime(frame.time); }} aria-label={`Go to ${track.property} keyframe ${index + 1}`} />)}</div>
            <div className="native-motion-keyframes">{track.keyframes.map((frame, index) => <div className="native-motion-keyframe" key={index}>
              <strong>Keyframe {index + 1}</strong>
              <label>Time (ms)<input type="number" min="0" max={timeline.duration} value={frame.time} onChange={(event) => updateKeyframe(trackIndex, index, { time: Number(event.target.value) })} /></label>
              <label>Value<input type="number" step="0.01" value={frame.value} onChange={(event) => updateKeyframe(trackIndex, index, { value: Number(event.target.value) })} /></label>
              <label>Easing<select value={frame.easing} onChange={(event) => updateKeyframe(trackIndex, index, { easing: event.target.value })}><option value="linear">Linear</option><option value="ease-in">Ease in</option><option value="ease-out">Ease out</option><option value="ease-in-out">Ease in-out</option></select></label>
            </div>)}</div>
          </div>
        ))}
      </div>
      {status && <p className="native-motion-status" role="status">{status}</p>}
      <small className="native-motion-disclosure">Current capabilities: browser-based keyframe authoring, live vector preview and local WebM recording. This is a rendered preview, not provider-generated cinematic footage.</small>
    </section>
  );
}
