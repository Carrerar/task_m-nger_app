import test from "node:test";
import assert from "node:assert/strict";

const { parseRoute, roomAllowed, nextCount, utcDate } = await import(
  "../worker/sync-worker.js"
);

test("parseRoute: single segment -> sync route", () => {
  assert.deepEqual(parseRoute("/my-private-room"), {
    room: "my-private-room",
    kind: "sync",
  });
  assert.deepEqual(parseRoute("///room_a///"), { room: "room_a", kind: "sync" });
});

test("parseRoute: <room>/ai -> ai route", () => {
  assert.deepEqual(parseRoute("/my-private-room/ai"), {
    room: "my-private-room",
    kind: "ai",
  });
});

test("parseRoute: rejects bad rooms and unknown shapes", () => {
  assert.equal(parseRoute("/short"), null, "room too short");
  assert.equal(parseRoute("/room/notai"), null, "2nd segment must be 'ai'");
  assert.equal(parseRoute("/room/ai/extra"), null, "no deeper paths");
  assert.equal(parseRoute("/"), null);
  assert.equal(parseRoute(""), null);
  assert.equal(parseRoute("/bad room/ai"), null, "space not in charset");
});

test("roomAllowed: only listed rooms pass", () => {
  assert.equal(roomAllowed("room-a", "room-a,room-b"), true);
  assert.equal(roomAllowed("room-b", " room-a , room-b "), true, "trims");
  assert.equal(roomAllowed("room-c", "room-a,room-b"), false);
  assert.equal(roomAllowed("room-a", ""), false, "empty allowlist -> deny");
  assert.equal(roomAllowed("room-a", undefined), false, "no allowlist -> deny");
});

test("nextCount: increments until cap, then blocks", () => {
  assert.deepEqual(nextCount(null, 3), { allowed: true, count: 1 });
  assert.deepEqual(nextCount("0", 3), { allowed: true, count: 1 });
  assert.deepEqual(nextCount("2", 3), { allowed: true, count: 3 });
  assert.deepEqual(nextCount("3", 3), { allowed: false, count: 3 });
  assert.deepEqual(nextCount("9", 3), { allowed: false, count: 9 });
  assert.deepEqual(nextCount("garbage", 3), { allowed: true, count: 1 });
});

test("utcDate: stable YYYY-MM-DD in UTC", () => {
  assert.equal(utcDate(Date.UTC(2026, 4, 20, 23, 59)), "2026-05-20");
  assert.equal(utcDate(Date.UTC(2026, 0, 1, 0, 0)), "2026-01-01");
});
