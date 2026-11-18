const CADENCES = new Set(["daily", "weekly"]);

function readLocalParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    weekday: "short", hour: "2-digit", minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(values.weekday);
  return {
    year: Number(values.year), month: Number(values.month), day: Number(values.day),
    hour: Number(values.hour), minute: Number(values.minute), weekday: weekdayIndex,
  };
}

function localDateKey(parts) {
  return [parts.year, String(parts.month).padStart(2, "0"), String(parts.day).padStart(2, "0")].join("-");
}

export function validateAutomationSchedule(input = {}) {
  const cadence = typeof input.cadence === "string" ? input.cadence : "";
  const timeZone = typeof input.timeZone === "string" ? input.timeZone.trim() : "";
  const hour = Number(input.hour);
  const minute = Number(input.minute ?? 0);
  const weekday = input.weekday === undefined ? null : Number(input.weekday);

  if (!CADENCES.has(cadence)) throw new TypeError("Choose a supported daily or weekly schedule.");
  if (!timeZone || timeZone.length > 80) throw new TypeError("Provide a valid IANA time zone.");
  try { new Intl.DateTimeFormat("en", { timeZone }).format(new Date()); }
  catch { throw new TypeError("The time zone is not recognised."); }
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 ||
      !Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new TypeError("Choose a valid local run time.");
  }
  if (cadence === "weekly" && (!Number.isInteger(weekday) || weekday < 0 || weekday > 6)) {
    throw new TypeError("Choose a weekday for weekly schedules.");
  }

  return Object.freeze({ cadence, timeZone, hour, minute, weekday: cadence === "weekly" ? weekday : null });
}

export function getNextAutomationRun(scheduleInput, now = new Date()) {
  const schedule = validateAutomationSchedule(scheduleInput);
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new TypeError("A valid current date is required.");

  // Scan absolute minutes; Intl handles daylight-saving and local calendar boundaries.
  const start = Math.floor(now.getTime() / 60000) * 60000 + 60000;
  const maxMinutes = 9 * 24 * 60;
  for (let offset = 0; offset < maxMinutes; offset++) {
    const candidate = new Date(start + offset * 60000);
    const local = readLocalParts(candidate, schedule.timeZone);
    if (local.hour !== schedule.hour || local.minute !== schedule.minute) continue;
    if (schedule.cadence === "weekly" && local.weekday !== schedule.weekday) continue;
    return Object.freeze({
      scheduled: false,
      previewOnly: true,
      nextRunAt: candidate.toISOString(),
      localDate: localDateKey(local),
      localTime: String(local.hour).padStart(2, "0") + ":" + String(local.minute).padStart(2, "0"),
      weekday: local.weekday,
      timeZone: schedule.timeZone,
      cadence: schedule.cadence,
      reason: "Preview only. No persistent schedule or background job has been created.",
    });
  }
  throw new Error("Could not find the next run within the preview window.");
}
