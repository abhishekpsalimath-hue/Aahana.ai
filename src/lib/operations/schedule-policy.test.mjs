import test from "node:test";
import assert from "node:assert/strict";
import { getNextAutomationRun, validateAutomationSchedule } from "./schedule-policy.mjs";

test("daily schedule preview resolves founder local time in Asia/Kolkata", () => {
  const next = getNextAutomationRun(
    { cadence: "daily", timeZone: "Asia/Kolkata", hour: 9, minute: 30 },
    new Date("2026-01-01T03:59:00.000Z"),
  );
  assert.equal(next.nextRunAt, "2026-01-01T04:00:00.000Z");
  assert.equal(next.localDate, "2026-01-01");
  assert.equal(next.localTime, "09:30");
  assert.equal(next.scheduled, false);
  assert.equal(next.previewOnly, true);
});

test("daily schedule after today's run moves to tomorrow", () => {
  const next = getNextAutomationRun(
    { cadence: "daily", timeZone: "UTC", hour: 9, minute: 30 },
    new Date("2026-01-01T09:30:00.000Z"),
  );
  assert.equal(next.nextRunAt, "2026-01-02T09:30:00.000Z");
});

test("weekly schedule selects the requested local weekday", () => {
  const next = getNextAutomationRun(
    { cadence: "weekly", timeZone: "UTC", weekday: 5, hour: 9, minute: 0 },
    new Date("2026-01-01T08:00:00.000Z"),
  );
  assert.equal(next.nextRunAt, "2026-01-02T09:00:00.000Z");
  assert.equal(next.weekday, 5);
});

test("schedule validation rejects invalid cadence, timezone and clock values", () => {
  assert.throws(() => validateAutomationSchedule({ cadence: "hourly", timeZone: "UTC", hour: 9 }), /daily or weekly/);
  assert.throws(() => validateAutomationSchedule({ cadence: "daily", timeZone: "Mars/Olympus", hour: 9 }), /time zone/);
  assert.throws(() => validateAutomationSchedule({ cadence: "daily", timeZone: "UTC", hour: 24 }), /local run time/);
  assert.throws(() => validateAutomationSchedule({ cadence: "weekly", timeZone: "UTC", hour: 9 }), /weekday/);
});

test("invalid current date is rejected", () => {
  assert.throws(() => getNextAutomationRun({ cadence: "daily", timeZone: "UTC", hour: 9 }, new Date("invalid")), /current date/);
});
