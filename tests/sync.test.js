import test from "node:test";
import assert from "node:assert/strict";

// store.js (imported transitively by sync.js) reads localStorage at load.
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};

const { decideSync, getSyncConfig, setSyncConfig, syncEnabled } = await import("../js/features/sync.js");

test("empty server -> push (seed it from local)", () => {
  assert.equal(decideSync(0, null), "push");
  assert.equal(decideSync(5, { rev: 0, data: null }), "push");
  assert.equal(decideSync(5, { rev: 3, data: null }), "push");
});

test("server ahead -> adopt", () => {
  assert.equal(decideSync(0, { rev: 1, data: {} }), "adopt");
  assert.equal(decideSync(4, { rev: 9, data: { tasks: [] } }), "adopt");
});

test("in sync or local ahead -> noop", () => {
  assert.equal(decideSync(5, { rev: 5, data: {} }), "noop");
  assert.equal(decideSync(7, { rev: 5, data: {} }), "noop");
});

test("config round-trips and clears rev when disabled", () => {
  setSyncConfig("https://x.workers.dev", "secret");
  mem.set("fb_sync_rev", "12");
  assert.equal(syncEnabled(), true);
  assert.deepEqual(getSyncConfig(), { url: "https://x.workers.dev", token: "secret" });

  setSyncConfig("", "");
  assert.equal(syncEnabled(), false);
  assert.equal(mem.has("fb_sync_rev"), false, "rev cleared when sync turned off");
});
