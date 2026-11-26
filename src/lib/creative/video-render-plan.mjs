import { validateVideoProject } from "./video-project.mjs";

const FPS = new Set([24, 25, 30, 50, 60]);
const FORMATS = Object.freeze({
  mp4: Object.freeze(["h264"]),
  webm: Object.freeze(["vp9"]),
});
const MAX_DIMENSION = 3840;

function normalizeExportSettings(settings = {}) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw new TypeError("Video export settings must be an object.");
  }
  const width = settings.width === undefined ? 1920 : settings.width;
  const height = settings.height === undefined ? 1080 : settings.height;
  const fps = settings.fps === undefined ? 30 : settings.fps;
  const format = settings.format === undefined ? "mp4" : settings.format;
  const codec = settings.codec === undefined ? "h264" : settings.codec;
  if (!Number.isInteger(width) || width < 16 || width > MAX_DIMENSION ||
      !Number.isInteger(height) || height < 16 || height > MAX_DIMENSION) {
    throw new RangeError("Export dimensions must be integers from 16 to 3840 pixels.");
  }
  if (!FPS.has(fps)) throw new RangeError("Export frame rate must be 24, 25, 30, 50 or 60 fps.");
  if (!Object.hasOwn(FORMATS, format) || !FORMATS[format].includes(codec)) {
    throw new TypeError("The selected video container and codec combination is unsupported.");
  }
  if (codec === "h264" && (width % 2 !== 0 || height % 2 !== 0)) {
    throw new RangeError("H.264 export dimensions must be even numbers.");
  }
  if (typeof settings.includeAudio !== "undefined" && typeof settings.includeAudio !== "boolean") {
    throw new TypeError("includeAudio must be a boolean.");
  }
  return Object.freeze({ width, height, fps, format, codec, includeAudio: settings.includeAudio !== false });
}

/**
 * Compile a validated edit graph into a deterministic, renderer-neutral EDL.
 * This prepares render instructions only; it does not fetch assets or render/export media.
 */
export function compileVideoRenderPlan(projectInput, exportSettings = {}) {
  const project = validateVideoProject(projectInput);
  const output = normalizeExportSettings(exportSettings);
  const assets = new Set();
  let durationSeconds = 0;

  const tracks = project.tracks.map((track, trackIndex) => {
    const clips = track.clips.map((clip, clipIndex) => {
      const end = clip.start + clip.duration;
      durationSeconds = Math.max(durationSeconds, end);
      assets.add(clip.assetId);
      const keyframes = clip.keyframes.map((frame) => Object.freeze({
        at: Number((clip.start + frame.at).toFixed(6)),
        offset: frame.at,
        property: frame.property,
        value: frame.value,
        easing: frame.easing,
      }));
      return Object.freeze({
        order: clipIndex,
        id: clip.id,
        assetId: clip.assetId,
        timeline: Object.freeze({ start: clip.start, end, duration: clip.duration }),
        source: Object.freeze({ start: clip.sourceStart, duration: clip.sourceDuration }),
        playback: Object.freeze({
          speed: clip.speed,
          volume: output.includeAudio && !track.muted ? clip.volume : 0,
          muted: track.muted || !output.includeAudio,
        }),
        keyframes: Object.freeze(keyframes),
        transitions: Object.freeze({
          in: clip.transitionIn,
          out: clip.transitionOut,
        }),
      });
    });
    return Object.freeze({
      order: trackIndex,
      id: track.id,
      type: track.type,
      name: track.name,
      muted: track.muted,
      clips: Object.freeze(clips),
    });
  });

  const frameCount = Math.ceil(durationSeconds * output.fps);
  return Object.freeze({
    schema: "aahana.video-edl.v1",
    projectId: project.id,
    projectVersion: project.version,
    status: "planned",
    execution: "not-rendered",
    output,
    durationSeconds,
    frameCount,
    assets: Object.freeze([...assets].sort()),
    tracks: Object.freeze(tracks),
    limitations: Object.freeze([
      "Renderer-neutral edit decision list only; no media has been fetched or rendered.",
      "Asset IDs must be resolved through an authenticated, owner-scoped asset service by a future renderer.",
      "Provider-specific encoding, audio mixing and visual-effect execution are not performed by this compiler.",
    ]),
  });
}

export const VIDEO_EXPORT_LIMITS = Object.freeze({
  minDimension: 16,
  maxDimension: MAX_DIMENSION,
  frameRates: Object.freeze([...FPS].sort((a, b) => a - b)),
  formats: Object.freeze(Object.fromEntries(Object.entries(FORMATS).map(([format, codecs]) => [format, Object.freeze([...codecs])]))),
});
