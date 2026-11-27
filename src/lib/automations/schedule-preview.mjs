const WEEKDAY_INDEX = Object.freeze({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 });

function formatterFor(timeZone) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    return null;
  }
}

function localParts(formatter, date) {
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: WEEKDAY_INDEX[parts.weekday],
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function validSchedule(schedule) {
  if (!schedule || typeof schedule !== "object" ||
      !["daily", "weekly"].includes(schedule.frequency) ||
      !Number.isInteger(schedule.hour) || schedule.hour < 0 || schedule.hour > 23 ||
      !Number.isInteger(schedule.minute) || schedule.minute < 0 || schedule.minute > 59 ||
      typeof schedule.timeZone !== "string" || !formatterFor(schedule.timeZone)) return false;
  if (schedule.frequency === "weekly") {
    return Array.isArray(schedule.daysOfWeek) && schedule.daysOfWeek.length > 0 &&
      schedule.daysOfWeek.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) &&
      new Set(schedule.daysOfWeek).size === schedule.daysOfWeek.length;
  }
  return true;
}

function firstInstantForLocalTime(formatter, year, month, day, hour, minute) {
  // Sample the surrounding offsets, then verify candidate instants against
  // the zone formatter. During fall-back, choose the earlier matching instant.
  const targetWallTime = Date.UTC(year, month - 1, day, hour, minute);
  const offsets = new Set();
  for (let delta = -18 * 60 * 60_000; delta <= 18 * 60 * 60_000; delta += 6 * 60 * 60_000) {
    const sample = targetWallTime + delta;
    const parts = localParts(formatter, new Date(sample));
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    offsets.add(represented - sample);
  }
  const candidates = [...offsets]
    .map((offset) => new Date(targetWallTime - offset))
    .filter((candidate) => {
      const parts = localParts(formatter, candidate);
      return parts.year === year && parts.month === month && parts.day === day &&
        parts.hour === hour && parts.minute === minute;
    })
    .sort((a, b) => a.getTime() - b.getTime());
  // A spring-forward gap has no matching instant for the requested wall time.
  return candidates[0] || null;
}

/**
 * Preview the next daily/weekly occurrences in the schedule's IANA time zone.
 * DST gaps are skipped for that date; repeated fall-back wall times resolve to
 * their first instant. The caller must still persist and enforce run idempotency.
 */
export function previewScheduleOccurrences(schedule, after, count = 5) {
  if (!validSchedule(schedule) || !Number.isInteger(count) || count < 1 || count > 20) return null;
  const afterDate = after instanceof Date ? after : new Date(after);
  if (!Number.isFinite(afterDate.getTime())) return null;
  const formatter = formatterFor(schedule.timeZone);
  const localStart = localParts(formatter, afterDate);
  const cursor = new Date(Date.UTC(localStart.year, localStart.month - 1, localStart.day));
  const occurrences = [];
  // Weekly schedules may need up to three weeks to fill a 20-item preview.
  const searchDays = schedule.frequency === "weekly" ? count * 7 + 7 : count + 7;
  for (let offset = 0; offset < searchDays && occurrences.length < count; offset += 1) {
    const date = new Date(cursor.getTime() + offset * 86_400_000);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const weekday = date.getUTCDay();
    if (schedule.frequency === "weekly" && !schedule.daysOfWeek.includes(weekday)) continue;
    const instant = firstInstantForLocalTime(
      formatter, year, month, day, schedule.hour, schedule.minute,
    );
    if (!instant || instant.getTime() <= afterDate.getTime()) continue;
    occurrences.push(Object.freeze({
      at: instant.toISOString(),
      localDate: [year, String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-"),
      timeZone: schedule.timeZone,
      localTime: `${String(schedule.hour).padStart(2, "0")}:${String(schedule.minute).padStart(2, "0")}`,
    }));
  }
  return Object.freeze(occurrences);
}
