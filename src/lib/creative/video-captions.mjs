const MAX_CUES = 500;
const MAX_TEXT_LENGTH = 300;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
const LANGUAGE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

function requireText(value, label, max) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new TypeError(label + " must be 1–" + max + " characters.");
  }
  return value.trim();
}

function timestamp(value, label) {
  if (!Number.isFinite(value) || value < 0 || value > 4 * 60 * 60) {
    throw new RangeError(label + " must be between 0 and four hours.");
  }
  return value;
}

function formatTime(seconds, separator) {
  const milliseconds = Math.round(seconds * 1000);
  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor((milliseconds % 3600000) / 60000);
  const wholeSeconds = Math.floor((milliseconds % 60000) / 1000);
  const millis = milliseconds % 1000;
  return String(hours).padStart(2, "0") + ":" +
    String(minutes).padStart(2, "0") + ":" +
    String(wholeSeconds).padStart(2, "0") + separator +
    String(millis).padStart(3, "0");
}

function safeCaptionText(value) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/</g, "‹").replace(/>/g, "›");
}

/** Validate, sort and freeze a single-language caption track. */
export function validateVideoCaptionTrack(input, { durationSeconds } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("A caption track object is required.");
  }
  if (durationSeconds !== undefined && (!Number.isFinite(durationSeconds) || durationSeconds < 0 || durationSeconds > 4 * 60 * 60)) {
    throw new RangeError("Video duration must be between 0 and four hours.");
  }
  const language = requireText(input.language, "Caption language", 35);
  if (!LANGUAGE_PATTERN.test(language)) throw new TypeError("Caption language must be a valid BCP 47-style language tag.");
  const label = input.label === undefined ? language : requireText(input.label, "Caption label", 60);
  if (!Array.isArray(input.cues) || input.cues.length < 1 || input.cues.length > MAX_CUES) {
    throw new RangeError("A caption track must contain between 1 and 500 cues.");
  }
  const seen = new Set();
  const cues = input.cues.map((cue, index) => {
    if (!cue || typeof cue !== "object" || Array.isArray(cue)) throw new TypeError("Caption cue " + (index + 1) + " must be an object.");
    if (typeof cue.id !== "string" || !ID_PATTERN.test(cue.id) || seen.has(cue.id)) {
      throw new TypeError("Caption cue ids must be unique stable identifiers.");
    }
    seen.add(cue.id);
    const start = timestamp(cue.start, "Caption start");
    const end = timestamp(cue.end, "Caption end");
    if (end <= start) throw new RangeError("Caption cue end must be after its start.");
    if (end - start > 10) throw new RangeError("A caption cue cannot exceed 10 seconds.");
    if (Number.isFinite(durationSeconds) && end > durationSeconds) {
      throw new RangeError("A caption cue cannot extend beyond the video duration.");
    }
    const text = requireText(cue.text, "Caption text", MAX_TEXT_LENGTH);
    if (text.split(/\r?\n/).length > 2) throw new RangeError("A caption cue can contain at most two lines.");
    const speaker = cue.speaker === undefined || cue.speaker === null || cue.speaker === ""
      ? null : requireText(cue.speaker, "Caption speaker", 40);
    return Object.freeze({ id: cue.id, start, end, text: safeCaptionText(text), speaker });
  }).sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id));

  for (let index = 1; index < cues.length; index += 1) {
    if (cues[index].start < cues[index - 1].end) {
      throw new RangeError("Caption cues in one track cannot overlap.");
    }
  }
  return Object.freeze({ language, label, cues: Object.freeze(cues) });
}

/** Export a validated caption track as SubRip (.srt) text. */
export function exportVideoCaptionsAsSrt(input, options = {}) {
  const track = validateVideoCaptionTrack(input, options);
  return track.cues.map((cue, index) => [
    String(index + 1),
    formatTime(cue.start, ",") + " --> " + formatTime(cue.end, ","),
    cue.speaker ? cue.speaker + ": " + cue.text : cue.text,
  ].join("\n")).join("\n\n") + "\n";
}

/** Export a validated caption track as WebVTT text. */
export function exportVideoCaptionsAsWebVtt(input, options = {}) {
  const track = validateVideoCaptionTrack(input, options);
  return "WEBVTT\n\n" + track.cues.map((cue) => [
    cue.id,
    formatTime(cue.start, ".") + " --> " + formatTime(cue.end, "."),
    cue.speaker ? cue.speaker + ": " + cue.text : cue.text,
  ].join("\n")).join("\n\n") + "\n";
}

export const VIDEO_CAPTION_LIMITS = Object.freeze({
  maxCues: MAX_CUES,
  maxTextCharacters: MAX_TEXT_LENGTH,
  maxCueSeconds: 10,
  maxTimelineSeconds: 4 * 60 * 60,
});
