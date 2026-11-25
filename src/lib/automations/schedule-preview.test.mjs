import test from "node:test";
import assert from "node:assert/strict";
import { previewScheduleOccurrences } from "./schedule-preview.mjs";

test("previews daily occurrences in the schedule timezone", () => {
  const result = previewScheduleOccurrences({
    frequency: "daily", hour: 9, minute: 30, timeZone: "Asia/Kolkata",
  }, "2026-11-25T03:00:00.000Z", 2);
  assert.deepEqual(result.map((item) => item.at), [
    "2026-11-25T04:00:00.000Z",
    "2026-11-26T04:00:00.000Z",
  ]);
  assert.equal(result[0].localTime, "09:30");
});

test("previews only selected weekdays for weekly schedules", () => {
  const result = previewScheduleOccurrences({
    frequency: "weekly", daysOfWeek: [1, 3], hour: 8, minute: 0, timeZone: "Asia/Kolkata",
  }, "2026-11-25T03:00:00.000Z", 3);
  assert.deepEqual(result.map((item) => item.localDate), ["2026-11-25", "2026-11-30", "2026-12-02"]);
});

test("skips a nonexistent spring-forward wall-clock time", () => {
  const result = previewScheduleOccurrences({
    frequency: "daily", hour: 2, minute: 30, timeZone: "America/New_York",
  }, "2026-03-08T05:00:00.000Z", 2);
  assert.deepEqual(result.map((item) => item.at), [
    "2026-03-09T06:30:00.000Z",
    "2026-03-10T06:30:00.000Z",
  ]);
});

test("resolves a repeated fall-back wall-clock time to its first instant", () => {
  const result = previewScheduleOccurrences({
    frequency: "daily", hour: 1, minute: 30, timeZone: "America/New_York",
  }, "2026-11-01T04:00:00.000Z", 2);
  assert.deepEqual(result.map((item) => item.at), [
    "2026-11-01T05:30:00.000Z",
    "2026-11-02T06:30:00.000Z",
  ]);
});

test("rejects invalid schedules, dates, and preview bounds", () => {
  assert.equal(previewScheduleOccurrences({ frequency: "monthly", timeZone: "UTC", hour: 9, minute: 0 }, new Date(), 3), null);
  assert.equal(previewScheduleOccurrences({ frequency: "weekly", daysOfWeek: [7], timeZone: "UTC", hour: 9, minute: 0 }, new Date(), 3), null);
  assert.equal(previewScheduleOccurrences({ frequency: "daily", timeZone: "Not/AZone", hour: 9, minute: 0 }, new Date(), 3), null);
  assert.equal(previewScheduleOccurrences({ frequency: "daily", timeZone: "UTC", hour: 9, minute: 0 }, "invalid", 3), null);
  assert.equal(previewScheduleOccurrences({ frequency: "daily", timeZone: "UTC", hour: 9, minute: 0 }, new Date(), 21), null);
});
