"use client";

import { useEffect, useMemo, useState } from "react";
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
  const sampled = useMemo(() => sampleMotionTimeline(timeline, time), [timeline, time]);
  const x = sampled.find((item) => item.property === "cx")?.value ?? 180;

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

  function updateKeyframe(index, patch) {
    setTimeline((current) => ({
      ...current,
      tracks: current.tracks.map((track, trackIndex) => {
        if (trackIndex !== 0) return track;
        const keyframes = track.keyframes.map((frame, frameIndex) => {
          if (frameIndex !== index) return frame;
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

  function addKeyframe() {
    const frames = timeline.tracks[0].keyframes;
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
    const value = Math.round((left.value + right.value) / 2);
    setTimeline((current) => ({
      ...current,
      tracks: current.tracks.map((track, index) => index === 0 ? { ...track, keyframes: [...track.keyframes, { time: midpoint, value, easing: "ease-in-out" }].sort((a, b) => a.time - b.time) } : track),
    }));
    setStatus("A midpoint keyframe was added.");
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
    setStatus("Motion timeline exported as JSON. Video rendering is not included yet.");
  }

  return (
    <section className="native-motion-studio" aria-label="Aahana native motion studio">
      <div className="native-motion-heading"><div><span>AAHANA-NATIVE MOTION ENGINE</span><h3>Motion & Animation Studio</h3><p>Build keyframed movement and preview it live, locally in your browser.</p></div><button type="button" onClick={exportTimeline}>Export timeline</button></div>
      <div className="native-motion-stage">
        <svg viewBox="0 0 1000 360" role="img" aria-label="Animated preview of a lavender sphere moving across a stage">
          <defs><linearGradient id="aahana-motion-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#282038"/><stop offset="1" stopColor="#171421"/></linearGradient><radialGradient id="aahana-motion-ball"><stop offset="0" stopColor="#f4eafa"/><stop offset=".45" stopColor="#c7a8ed"/><stop offset="1" stopColor="#8064ae"/></radialGradient></defs>
          <rect width="1000" height="360" rx="16" fill="url(#aahana-motion-bg)"/>
          <path d="M70 285H930" stroke="#79678f" strokeWidth="2" strokeDasharray="5 9"/>
          <circle cx={x} cy="180" r="64" fill="url(#aahana-motion-ball)"/>
          <circle cx={x - 20} cy="157" r="12" fill="#fff" opacity=".28"/>
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
        <div className="native-motion-track-title"><strong>Position · X</strong><button type="button" onClick={addKeyframe} disabled={timeline.tracks[0].keyframes.length >= 20}>+ Add keyframe</button></div>
        <div className="native-motion-ruler"><span>0s</span><span>{(timeline.duration / 2000).toFixed(1)}s</span><span>{(timeline.duration / 1000).toFixed(1)}s</span></div>
        <div className="native-motion-track">{timeline.tracks[0].keyframes.map((frame, index) => <button type="button" key={index} className={Math.abs(time - frame.time) < 80 ? "active" : ""} style={{ left: `${frame.time / timeline.duration * 100}%` }} onClick={() => { setPlaying(false); setTime(frame.time); }} aria-label={`Go to keyframe ${index + 1}`} />)}</div>
        <div className="native-motion-keyframes">{timeline.tracks[0].keyframes.map((frame, index) => <div className="native-motion-keyframe" key={index}>
          <strong>Keyframe {index + 1}</strong>
          <label>Time (ms)<input type="number" min="0" max={timeline.duration} value={frame.time} onChange={(event) => updateKeyframe(index, { time: Number(event.target.value) })} /></label>
          <label>X position<input type="number" min="80" max="920" value={frame.value} onChange={(event) => updateKeyframe(index, { value: Number(event.target.value) })} /></label>
          <label>Easing<select value={frame.easing} onChange={(event) => updateKeyframe(index, { easing: event.target.value })}><option value="linear">Linear</option><option value="ease-in">Ease in</option><option value="ease-out">Ease out</option><option value="ease-in-out">Ease in-out</option></select></label>
        </div>)}</div>
      </div>
      {status && <p className="native-motion-status" role="status">{status}</p>}
      <small className="native-motion-disclosure">Current capability: browser-based keyframe authoring and live vector preview. This editor does not yet encode or export a video file.</small>
    </section>
  );
}
