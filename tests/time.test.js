import test from "node:test";
import assert from "node:assert/strict";
import {
  todayKey,
  monthKey,
  parseDateKey,
  addDays,
  startOfWeek,
  combineDateAndTime,
  formatTimeInput,
  formatTime,
  formatDateShort,
  formatDateLong,
  minuteOfDay,
  secondsToClock,
  minutesLabel,
} from "../js/core/time.js";

// Month is 0-based in the Date constructor: 4 === May.
const may17 = new Date(2026, 4, 17, 9, 5, 30);

test("todayKey formats a zero-padded YYYY-MM-DD", () => {
  assert.equal(todayKey(may17), "2026-05-17");
  assert.equal(todayKey(new Date(2026, 0, 3)), "2026-01-03");
});

test("monthKey formats YYYY-MM", () => {
  assert.equal(monthKey(may17), "2026-05");
});

test("parseDateKey round-trips with todayKey", () => {
  const d = parseDateKey("2026-05-17");
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 4);
  assert.equal(d.getDate(), 17);
  assert.equal(todayKey(d), "2026-05-17");
});

test("addDays does not mutate the input and crosses month boundaries", () => {
  const base = new Date(2026, 4, 30);
  const next = addDays(base, 3);
  assert.equal(base.getDate(), 30, "input untouched");
  assert.equal(todayKey(next), "2026-06-02");
  assert.equal(todayKey(addDays(base, -30)), "2026-04-30");
});

test("startOfWeek returns the Sunday on/before the date", () => {
  const s = startOfWeek(may17);
  assert.equal(s.getDay(), 0, "is a Sunday");
  assert.ok(s.getTime() <= new Date(2026, 4, 17).getTime());
  assert.ok(new Date(2026, 4, 17).getTime() - s.getTime() < 7 * 86400000);
});

test("combineDateAndTime builds a local datetime; missing time -> midnight", () => {
  const dt = combineDateAndTime("2026-05-17", "09:30");
  assert.equal(dt.getHours(), 9);
  assert.equal(dt.getMinutes(), 30);
  const mid = combineDateAndTime("2026-05-17", "");
  assert.equal(mid.getHours(), 0);
  assert.equal(mid.getMinutes(), 0);
});

test("formatTimeInput zero-pads HH:MM", () => {
  assert.equal(formatTimeInput(new Date(2026, 4, 17, 9, 5)), "09:05");
  assert.equal(formatTimeInput(new Date(2026, 4, 17, 23, 0)), "23:00");
});

test("minuteOfDay counts minutes since midnight including seconds", () => {
  assert.equal(minuteOfDay(new Date(2026, 4, 17, 1, 30, 30)), 90.5);
  assert.equal(minuteOfDay(new Date(2026, 4, 17, 0, 0, 0)), 0);
});

test("secondsToClock clamps negatives and pads MM:SS", () => {
  assert.equal(secondsToClock(0), "00:00");
  assert.equal(secondsToClock(65), "01:05");
  assert.equal(secondsToClock(-5), "00:00");
  assert.equal(secondsToClock(3600), "60:00");
});

test("minutesLabel rounds seconds to whole minutes", () => {
  assert.equal(minutesLabel(90), 2);
  assert.equal(minutesLabel(89), 1);
  assert.equal(minutesLabel(0), 0);
});

test("Intl formatters produce the expected shape", () => {
  assert.match(formatTime(may17), /^\d{1,2}:\d{2}$/);
  // Separator is ICU/locale dependent ("/" in Chrome, "-" in Node) — only
  // assert the two zero-padded numeric fields, not the delimiter.
  assert.match(formatDateShort(may17), /^\d{2}\D\d{2}$/);
  assert.match(formatDateLong(may17), /\b2026\b/);
});
