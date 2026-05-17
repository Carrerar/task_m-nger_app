import test from "node:test";
import assert from "node:assert/strict";

// store.js reads localStorage at import time (inside a try/catch, so a
// missing global already falls back to empty data). Provide an explicit
// in-memory stub so the behaviour is deterministic across Node versions.
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};

const {
  taskCategory,
  statusLabel,
  urgencyClass,
  durationVarianceLabel,
  scheduleDriftLabel,
  scoreLabel,
  taskAddedTimestamp,
} = await import("../js/core/selectors.js");

test("taskCategory trims, falls back to 'Chưa phân loại'", () => {
  assert.equal(taskCategory({ category: "  Code  " }), "Code");
  assert.equal(taskCategory({}), "Chưa phân loại");
  assert.equal(taskCategory({ category: "   " }), "Chưa phân loại");
});

test("statusLabel maps every status", () => {
  assert.equal(statusLabel({ status: "running" }), "Đang làm");
  assert.equal(statusLabel({ status: "paused" }), "Tạm dừng");
  assert.equal(statusLabel({ status: "complete" }), "Hoàn thành");
  assert.equal(statusLabel({ status: "idle" }), "Chưa làm");
});

test("urgencyClass reflects remaining-time ratio", () => {
  assert.equal(urgencyClass({ status: "complete" }), "is-done");
  assert.equal(urgencyClass({ status: "running", plannedMinutes: 0 }), "is-safe");
  const t = (rem) => ({ status: "running", plannedMinutes: 10, remainingSeconds: rem });
  assert.equal(urgencyClass(t(60)), "is-danger"); // 0.10
  assert.equal(urgencyClass(t(240)), "is-warning"); // 0.40
  assert.equal(urgencyClass(t(480)), "is-safe"); // 0.80
});

test("durationVarianceLabel compares planned vs elapsed", () => {
  assert.equal(durationVarianceLabel({ status: "running" }), "Chưa chốt thời lượng");
  const done = (elapsed) => ({ status: "complete", plannedMinutes: 10, elapsedSeconds: elapsed });
  assert.equal(durationVarianceLabel(done(600)), "Đúng thời lượng");
  assert.equal(durationVarianceLabel(done(300)), "Hoàn thành sớm 5 phút");
  assert.equal(durationVarianceLabel(done(900)), "Vượt dự kiến 5 phút");
});

test("scheduleDriftLabel measures start drift in minutes", () => {
  assert.equal(scheduleDriftLabel({}), "Theo lịch dự kiến");
  const base = "2026-05-17T09:00:00";
  assert.equal(
    scheduleDriftLabel({ scheduledStartAt: base, firstStartedAt: base }),
    "Đúng giờ",
  );
  assert.equal(
    scheduleDriftLabel({ scheduledStartAt: base, firstStartedAt: "2026-05-17T09:10:00" }),
    "Bắt đầu trễ 10 phút",
  );
  assert.equal(
    scheduleDriftLabel({ scheduledStartAt: base, firstStartedAt: "2026-05-17T08:55:00" }),
    "Bắt đầu sớm 5 phút",
  );
});

test("scoreLabel buckets the 0..3 score", () => {
  assert.equal(scoreLabel(0), "Chưa có dữ liệu");
  assert.equal(scoreLabel(undefined), "Chưa có dữ liệu");
  assert.equal(scoreLabel(1.5), "Thấp (1.5/3)");
  assert.equal(scoreLabel(2.0), "Trung bình (2.0/3)");
  assert.equal(scoreLabel(2.5), "Cao (2.5/3)");
});

test("taskAddedTimestamp prefers the id timestamp, else createdAt", () => {
  assert.equal(taskAddedTimestamp({ id: "1680000000000-abc" }), 1680000000000);
  const viaCreatedAt = taskAddedTimestamp({ id: "no-ts", createdAt: "2026-05-17T00:00:00Z" });
  assert.equal(viaCreatedAt, new Date("2026-05-17T00:00:00Z").getTime());
});
