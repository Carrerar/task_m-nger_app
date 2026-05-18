import test from "node:test";
import assert from "node:assert/strict";

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};

const { SESSION_CAP } = await import("../js/core/constants.js");
const { state, saveData, saveDataLocal, replaceData, onAfterSave } = await import("../js/core/store.js");

function makeSessions(n) {
  return Array.from({ length: n }, (_, i) => ({ id: `s${i}`, seq: i }));
}

test("saveData caps sessions to SESSION_CAP, keeping the newest", () => {
  state.data.sessions = makeSessions(SESSION_CAP + 250);
  saveData();
  assert.equal(state.data.sessions.length, SESSION_CAP);
  // Tail preserved: last element is the most recent one pushed.
  assert.equal(state.data.sessions.at(-1).seq, SESSION_CAP + 250 - 1);
  assert.equal(state.data.sessions[0].seq, 250);
});

test("saveData leaves a sub-cap session list untouched", () => {
  state.data.sessions = makeSessions(10);
  saveData();
  assert.equal(state.data.sessions.length, 10);
});

test("saveDataLocal persists but does NOT fire afterSave; saveData does", () => {
  let calls = 0;
  onAfterSave(() => { calls += 1; });
  state.data.sessions = makeSessions(3);

  saveDataLocal();
  assert.equal(calls, 0, "local-only save must not schedule a sync push");
  assert.equal(JSON.parse(mem.get("personal_productivity_data_v1")).sessions.length, 3);

  saveData();
  assert.equal(calls, 1, "saveData must fire afterSave");
});

test("replaceData caps an oversized imported payload on reload", () => {
  replaceData({ tasks: [], sessions: makeSessions(SESSION_CAP + 99), categories: [], recurring: [] });
  assert.equal(state.data.sessions.length, SESSION_CAP);
  assert.equal(state.data.sessions.at(-1).seq, SESSION_CAP + 99 - 1);
});
