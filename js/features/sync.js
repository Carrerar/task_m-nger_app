// Multi-device sync against the Cloudflare Worker (worker/sync-worker.js).
//
// Model: the server holds one snapshot { rev, updatedAt, data } and bumps
// `rev` on every write. We keep our last-seen rev in localStorage. On pull,
// if the server is ahead we adopt it; otherwise our local saves push up
// (debounced). Last-write-wins — see docs/SYNC_SETUP.md for the accepted
// concurrent-edit tradeoff.
//
// DOM-free on purpose so the decision logic stays unit-testable.

import { state, replaceData } from "../core/store.js";

const URL_KEY = "fb_sync_url";
const TOKEN_KEY = "fb_sync_token";
const ROOM_KEY = "fb_sync_room";
const REV_KEY = "fb_sync_rev";
const PUSH_DEBOUNCE_MS = 4000;

let pushTimer = null;
let pushing = false;
let lastStatus = "off"; // off | syncing | ok | error
let notify = () => {};

export function getSyncConfig() {
  return {
    url: localStorage.getItem(URL_KEY) || "",
    token: localStorage.getItem(TOKEN_KEY) || "",
    room: localStorage.getItem(ROOM_KEY) || "",
  };
}

export function setSyncConfig(url, token, room) {
  const u = (url || "").trim();
  const t = (token || "").trim();
  const r = (room || "").trim();
  const roomChanged = r !== (localStorage.getItem(ROOM_KEY) || "");
  if (u) localStorage.setItem(URL_KEY, u);
  else localStorage.removeItem(URL_KEY);
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
  if (r) localStorage.setItem(ROOM_KEY, r);
  else localStorage.removeItem(ROOM_KEY);
  // The last-seen rev belongs to one room's snapshot. Forget it when sync is
  // turned off OR the room changes, so the next pull adopts/seeds cleanly.
  if (!u || !t || !r || roomChanged) localStorage.removeItem(REV_KEY);
}

export function syncEnabled() {
  const { url, token, room } = getSyncConfig();
  return Boolean(url && token && room);
}

export function syncStatus() {
  return syncEnabled() ? lastStatus : "off";
}

export function onSyncStatus(fn) {
  notify = fn;
}

function setStatus(status) {
  lastStatus = status;
  notify(status);
}

function localRev() {
  return Number.parseInt(localStorage.getItem(REV_KEY) || "0", 10) || 0;
}

function setLocalRev(rev) {
  localStorage.setItem(REV_KEY, String(rev));
}

// Pure: given our rev and the server record, decide what to do.
//  "adopt" — server is newer, take its data
//  "push"  — server is empty, seed it from local
//  "noop"  — we're in sync (or already ahead via a pending push)
export function decideSync(currentRev, remote) {
  if (!remote || !remote.rev || remote.data == null) return "push";
  if (remote.rev > currentRev) return "adopt";
  return "noop";
}

async function api(method, body) {
  const { url, token, room } = getSyncConfig();
  // Worker namespaces data by room id taken from the URL path: /<room>.
  const endpoint = `${url.replace(/\/+$/, "")}/${encodeURIComponent(room)}`;
  const res = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`sync ${method} ${res.status}`);
  return res.json();
}

// Returns true when remote data was adopted (caller must re-render).
export async function pull() {
  if (!syncEnabled()) return false;
  setStatus("syncing");
  try {
    const remote = await api("GET");
    const action = decideSync(localRev(), remote);
    if (action === "adopt") {
      replaceData(remote.data);
      setLocalRev(remote.rev);
      setStatus("ok");
      return true;
    }
    if (action === "push") {
      await pushNow();
      return false;
    }
    setStatus("ok");
    return false;
  } catch {
    setStatus("error");
    return false;
  }
}

export async function pushNow() {
  if (!syncEnabled() || pushing) return;
  pushing = true;
  setStatus("syncing");
  try {
    const out = await api("PUT", { data: state.data });
    setLocalRev(out.rev);
    setStatus("ok");
  } catch {
    setStatus("error");
  } finally {
    pushing = false;
  }
}

// Debounced — wired to store.onAfterSave so a burst of edits (or the 12s
// tick save) collapses into one upload.
export function schedulePush() {
  if (!syncEnabled()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    pushNow();
  }, PUSH_DEBOUNCE_MS);
}
