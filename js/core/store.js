import { STORAGE_KEY, SESSION_CAP } from "./constants.js";
import { normalizeCategories } from "./utils.js";

function capSessions(sessions) {
  const list = Array.isArray(sessions) ? sessions : [];
  return list.length > SESSION_CAP ? list.slice(-SESSION_CAP) : list;
}

function loadData() {
  const fallback = { schemaVersion: 1, tasks: [], sessions: [], categories: [], recurring: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    const storedCategories = Array.isArray(parsed.categories) ? parsed.categories : [];
    const taskCategories = tasks
      .map((task) => task.category?.trim())
      .filter(Boolean);

    return {
      schemaVersion: 1,
      tasks,
      sessions: capSessions(parsed.sessions),
      categories: normalizeCategories([...storedCategories, ...taskCategories]),
      recurring: Array.isArray(parsed.recurring) ? parsed.recurring : [],
    };
  } catch {
    return fallback;
  }
}

// Single shared holder so every module sees the same data reference.
export const state = { data: loadData() };

// Listeners run after every local save (used by the sync layer to push).
// replaceData() deliberately does NOT fire these — adopting a remote
// snapshot must not bounce straight back to the server.
const afterSave = [];
export function onAfterSave(fn) {
  afterSave.push(fn);
}

function persist() {
  state.data.sessions = capSessions(state.data.sessions);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

export function saveData() {
  persist();
  afterSave.forEach((fn) => fn());
}

// Same local persistence but deliberately does NOT fire afterSave (so it
// schedules no sync push). Used only for the running timer's periodic
// checkpoint: that elapsed-time progress is re-derivable from lastStartedAt
// and reaches the server on the next real change / tab-hide / close anyway,
// so pushing it every TICK_SAVE_MS would just burn the shared KV write
// budget (~300 writes/hour per active timer) for nothing.
export function saveDataLocal() {
  persist();
}

// Persist a raw imported payload, then reload through the same normalizer.
export function replaceData(rawPayload) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rawPayload));
  state.data = loadData();
}
