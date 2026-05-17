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

export function saveData() {
  state.data.sessions = capSessions(state.data.sessions);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

// Persist a raw imported payload, then reload through the same normalizer.
export function replaceData(rawPayload) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rawPayload));
  state.data = loadData();
}
