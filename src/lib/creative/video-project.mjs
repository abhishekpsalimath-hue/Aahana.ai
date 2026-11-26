const TRACK_TYPES = new Set(["video", "audio", "text", "overlay", "effect"]);
const MAX_TRACKS = 32;
const MAX_CLIPS = 500;
const MAX_TIMELINE_SECONDS = 60 * 60 * 4;
const MAX_KEYFRAMES_PER_CLIP = 100;
const KEYFRAME_PROPERTIES = new Set(["positionX", "positionY", "scale", "rotation", "opacity", "volume", "cropX", "cropY", "blur", "brightness", "saturation"]);
const EASINGS = new Set(["linear", "ease-in", "ease-out", "ease-in-out", "hold"]);
const TRANSITIONS = new Set(["none", "crossfade", "dip-black", "wipe-left", "wipe-right", "zoom"]);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;

function requireId(value, label) {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) throw new TypeError(label + " must be a stable opaque identifier.");
  return value;
}

function normalizeKeyframes(value, duration) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > MAX_KEYFRAMES_PER_CLIP) throw new RangeError("A clip can contain at most 100 keyframes.");
  const seen = new Set();
  return Object.freeze(value.map((frame, index) => {
    if (!frame || typeof frame !== "object" || Array.isArray(frame)) throw new TypeError("Keyframe " + (index + 1) + " must be an object.");
    if (!KEYFRAME_PROPERTIES.has(frame.property)) throw new TypeError("Keyframe property is unsupported.");
    const at = finiteTime(frame.at, "Keyframe time");
    if (at > duration) throw new RangeError("Keyframe time cannot exceed its clip duration.");
    if (!Number.isFinite(frame.value)) throw new TypeError("Keyframe value must be finite.");
    if (frame.property === "opacity" && (frame.value < 0 || frame.value > 1)) throw new RangeError("Opacity keyframes must be between 0 and 1.");
    if (frame.property === "scale" && (frame.value < 0.01 || frame.value > 8)) throw new RangeError("Scale keyframes must be between 0.01 and 8.");
    const easing = frame.easing === undefined ? "linear" : frame.easing;
    if (!EASINGS.has(easing)) throw new TypeError("Keyframe easing is unsupported.");
    const key = frame.property + "::" + at;
    if (seen.has(key)) throw new Error("A property cannot have duplicate keyframes at the same time.");
    seen.add(key);
    return Object.freeze({ at, property: frame.property, value: frame.value, easing });
  }).sort((a, b) => a.at - b.at || a.property.localeCompare(b.property)));
}

function normalizeTransition(type, duration, label) {
  const value = type === undefined ? "none" : type;
  if (!TRANSITIONS.has(value)) throw new TypeError(label + " is unsupported.");
  if (value === "none") return Object.freeze({ type: value, duration: 0 });
  if (!Number.isFinite(duration) || duration <= 0 || duration > 10) throw new RangeError(label + " duration must be greater than 0 and no more than 10 seconds.");
  return Object.freeze({ type: value, duration });
}

function finiteTime(value, label, { allowZero = true } = {}) {
  if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0) || value > MAX_TIMELINE_SECONDS) {
    throw new RangeError(label + " must be within the supported four-hour timeline.");
  }
  return value;
}

/** Validate and freeze a non-destructive video edit decision graph. In-memory contract only; it does not persist or render media. */
export function validateVideoProject(project) {
  if (!project || typeof project !== "object" || Array.isArray(project)) throw new TypeError("A video project object is required.");
  const projectId = requireId(project.id, "Project id");
  const version = project.version === undefined ? 1 : project.version;
  if (!Number.isInteger(version) || version < 1) throw new RangeError("Project version must be a positive integer.");
  if (!Array.isArray(project.tracks) || project.tracks.length < 1 || project.tracks.length > MAX_TRACKS) {
    throw new RangeError("A video project must contain between 1 and 32 tracks.");
  }
  const trackIds = new Set();
  const clipIds = new Set();
  let clipCount = 0;
  const tracks = project.tracks.map((track, trackIndex) => {
    if (!track || typeof track !== "object" || Array.isArray(track)) throw new TypeError("Track " + (trackIndex + 1) + " must be an object.");
    const id = requireId(track.id, "Track id");
    if (trackIds.has(id)) throw new Error("Track ids must be unique.");
    trackIds.add(id);
    if (!TRACK_TYPES.has(track.type)) throw new TypeError("Track type is unsupported.");
    if (typeof track.name !== "string" || !track.name.trim() || track.name.length > 80) throw new TypeError("Track name must be 1–80 characters.");
    if (!Array.isArray(track.clips)) throw new TypeError("Track clips must be an array.");
    const clips = track.clips.map((clip, clipIndex) => {
      clipCount += 1;
      if (clipCount > MAX_CLIPS) throw new RangeError("A project cannot contain more than 500 clips.");
      if (!clip || typeof clip !== "object" || Array.isArray(clip)) throw new TypeError("Clip " + (clipIndex + 1) + " must be an object.");
      const clipId = requireId(clip.id, "Clip id");
      if (clipIds.has(clipId)) throw new Error("Clip ids must be unique across the project.");
      clipIds.add(clipId);
      const assetId = requireId(clip.assetId, "Clip asset id");
      const start = finiteTime(clip.start, "Clip start");
      const duration = finiteTime(clip.duration, "Clip duration", { allowZero: false });
      const sourceStart = clip.sourceStart === undefined ? 0 : finiteTime(clip.sourceStart, "Clip source start");
      const sourceDuration = clip.sourceDuration === undefined ? duration : finiteTime(clip.sourceDuration, "Clip source duration", { allowZero: false });
      if (sourceDuration < duration) throw new RangeError("Clip source duration cannot be shorter than its timeline duration.");
      if (start + duration > MAX_TIMELINE_SECONDS) throw new RangeError("Clip extends beyond the four-hour timeline.");
      const volume = clip.volume === undefined ? 1 : clip.volume;
      if (!Number.isFinite(volume) || volume < 0 || volume > 2) throw new RangeError("Clip volume must be between 0 and 2.");
      const speed = clip.speed === undefined ? 1 : clip.speed;
      if (!Number.isFinite(speed) || speed < 0.1 || speed > 8) throw new RangeError("Clip speed must be between 0.1× and 8×.");
      const keyframes = normalizeKeyframes(clip.keyframes, duration);
      const transitionIn = normalizeTransition(clip.transitionIn, clip.transitionInDuration, "Transition in");
      const transitionOut = normalizeTransition(clip.transitionOut, clip.transitionOutDuration, "Transition out");
      if (transitionIn.duration > duration / 2 || transitionOut.duration > duration / 2) throw new RangeError("A transition cannot exceed half of its clip duration.");
      return Object.freeze({ id: clipId, assetId, start, duration, sourceStart, sourceDuration, volume, speed, keyframes, transitionIn, transitionOut });
    }).sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
    return Object.freeze({ id, type: track.type, name: track.name.trim(), muted: track.muted === true, locked: track.locked === true, clips: Object.freeze(clips) });
  });
  return Object.freeze({ id: projectId, version, tracks: Object.freeze(tracks), clipCount });
}

export const VIDEO_PROJECT_LIMITS = Object.freeze({
  maxTracks: MAX_TRACKS, maxClips: MAX_CLIPS, maxTimelineSeconds: MAX_TIMELINE_SECONDS,
  trackTypes: Object.freeze([...TRACK_TYPES]),
});
