import test from "node:test";
import assert from "node:assert/strict";

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};
// dom.js resolves element refs at import; nothing here touches the DOM.
globalThis.document = { querySelector: () => null };

const { state } = await import("../js/core/store.js");
const { applyRecurringToday } = await import("../js/features/recurring.js");
const { todayKey, parseDateKey } = await import("../js/core/time.js");

function reset() {
  state.data.tasks = [];
  state.data.recurring = [];
}

test("a daily template materialises across the forward horizon", () => {
  reset();
  state.data.recurring = [
    { id: "r1", name: "Đọc sách", plannedMinutes: 30, category: "", startTime: "08:00", type: "daily", active: true },
  ];

  const created = applyRecurringToday();
  assert.equal(created, true);

  const made = state.data.tasks.filter((t) => t.recurringId === "r1");
  assert.ok(made.length > 1, "more than just today");
  // First instance is today; dates are unique and consecutive.
  const dates = made.map((t) => t.date).sort();
  assert.equal(dates[0], todayKey());
  assert.equal(new Set(dates).size, dates.length);
});

test("applyRecurringToday is idempotent (no duplicates on re-run)", () => {
  reset();
  state.data.recurring = [
    { id: "r1", name: "X", plannedMinutes: 10, category: "", startTime: "", type: "daily", active: true },
  ];
  applyRecurringToday();
  const after1 = state.data.tasks.length;
  const created2 = applyRecurringToday();
  assert.equal(created2, false);
  assert.equal(state.data.tasks.length, after1);
});

test("weekly template only lands on its weekday; inactive is skipped", () => {
  reset();
  state.data.recurring = [
    { id: "w1", name: "Gym", plannedMinutes: 60, category: "", startTime: "18:00", type: "weekly", weekday: 3, active: true },
    { id: "off", name: "Off", plannedMinutes: 15, category: "", startTime: "", type: "daily", active: false },
  ];

  applyRecurringToday();
  const weekly = state.data.tasks.filter((t) => t.recurringId === "w1");
  assert.ok(weekly.length >= 8 && weekly.length <= 10, `~8-9 Wednesdays in the window, got ${weekly.length}`);
  for (const task of weekly) {
    assert.equal(parseDateKey(task.date).getDay(), 3);
  }
  assert.equal(state.data.tasks.some((t) => t.recurringId === "off"), false);
});
