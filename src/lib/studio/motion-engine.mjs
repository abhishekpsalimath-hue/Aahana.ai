const PROPERTIES = new Set(["x", "y", "cx", "cy", "radius", "size", "opacity"]);
const EASINGS = new Set(["linear", "ease-in", "ease-out", "ease-in-out"]);
const MAX_DURATION = 60000;
const MAX_TRACKS = 50;
const MAX_KEYFRAMES = 100;

function number(value, fallback, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export function validateMotionTimeline(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const duration = Math.round(number(input.duration, 5000, 100, MAX_DURATION));
  const fps = Math.round(number(input.fps, 30, 1, 60));
  if (!Array.isArray(input.tracks) || input.tracks.length > MAX_TRACKS) return null;
  const tracks = [];
  for (const track of input.tracks) {
    if (!track || typeof track !== "object" || !PROPERTIES.has(track.property)) return null;
    if (!Number.isInteger(track.layerIndex) || track.layerIndex < 0 || !Array.isArray(track.keyframes) || track.keyframes.length < 2 || track.keyframes.length > MAX_KEYFRAMES) return null;
    const keyframes = [];
    let previousTime = -1;
    for (const frame of track.keyframes) {
      if (!frame || typeof frame !== "object") return null;
      const time = Math.round(number(frame.time, -1, 0, duration));
      if (time <= previousTime || !Number.isFinite(Number(frame.value))) return null;
      keyframes.push({ time, value: number(frame.value, 0, -100000, 100000), easing: EASINGS.has(frame.easing) ? frame.easing : "linear" });
      previousTime = time;
    }
    tracks.push({ id: String(track.id || `track-${tracks.length + 1}`).slice(0, 80), layerIndex: track.layerIndex, property: track.property, keyframes });
  }
  return { duration, fps, tracks };
}

function ease(progress, type) {
  if (type === "ease-in") return progress * progress;
  if (type === "ease-out") return 1 - (1 - progress) ** 2;
  if (type === "ease-in-out") return progress < 0.5 ? 2 * progress * progress : 1 - ((-2 * progress + 2) ** 2) / 2;
  return progress;
}

export function sampleMotionTrack(track, time) {
  if (!track || !Array.isArray(track.keyframes) || track.keyframes.length < 2) return null;
  const frames = track.keyframes;
  const t = number(time, 0, 0, MAX_DURATION);
  if (t <= frames[0].time) return frames[0].value;
  if (t >= frames[frames.length - 1].time) return frames[frames.length - 1].value;
  for (let index = 0; index < frames.length - 1; index += 1) {
    const start = frames[index];
    const end = frames[index + 1];
    if (t >= start.time && t <= end.time) {
      const progress = (t - start.time) / (end.time - start.time);
      const adjusted = ease(progress, start.easing);
      return start.value + (end.value - start.value) * adjusted;
    }
  }
  return frames[frames.length - 1].value;
}

export function sampleMotionTimeline(input, time) {
  const timeline = validateMotionTimeline(input);
  if (!timeline) throw new TypeError("Invalid Aahana motion timeline.");
  const currentTime = number(time, 0, 0, timeline.duration);
  return timeline.tracks.map((track) => ({
    id: track.id,
    layerIndex: track.layerIndex,
    property: track.property,
    value: sampleMotionTrack(track, currentTime),
  }));
}

export function createMotionTimeline(duration = 5000, fps = 30) {
  return { duration, fps, tracks: [] };
}
