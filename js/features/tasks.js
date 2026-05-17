import { state, saveData } from "../core/store.js";
import { ui } from "../core/ui-state.js";
import { saveAndRender, render, renderTick } from "../core/bus.js";
import { TICK_SAVE_MS } from "../core/constants.js";
import { unlockAudio, playDoneBell } from "../ui/audio.js";
import { createId, normalizeCategory, normalizeCategories } from "../core/utils.js";
import { todayKey, combineDateAndTime, formatTimeInput, minutesLabel } from "../core/time.js";
import {
  activeTask,
  lockedTask,
  ensureSingleTimer,
  taskCategory,
  taskTimeWindow,
} from "../core/selectors.js";

let tickHandle = null;
let lastTickSaveAt = 0;

/* ----------------------------- timer engine ----------------------------- */

export function syncRunningTask() {
  const running = activeTask();
  if (!running || !running.lastStartedAt) return;

  const elapsed = Math.floor((Date.now() - running.lastStartedAt) / 1000);
  if (elapsed <= 0) return;

  running.elapsedSeconds += elapsed;
  running.remainingSeconds = Math.max(0, running.remainingSeconds - elapsed);
  running.lastStartedAt = Date.now();

  if (running.remainingSeconds === 0) {
    completeTimer(running, true);
    playDoneBell();
  }
}

function completeTimer(task, finishedByTimer) {
  task.status = finishedByTimer ? "complete" : task.status;
  task.completedAt = finishedByTimer ? new Date().toISOString() : task.completedAt;
  task.endedAt = finishedByTimer ? task.completedAt : task.endedAt;
  task.lastStartedAt = null;
  addSession(task, finishedByTimer, finishedByTimer ? "timerDone" : "sessionUpdate");
}

function addSession(task, completedTimer, reason = "legacy") {
  const lastSession = state.data.sessions.findLast?.((session) => session.taskId === task.id);
  const now = new Date().toISOString();
  const elapsedMinutes = minutesLabel(task.elapsedSeconds);

  if (lastSession && lastSession.elapsedSeconds === task.elapsedSeconds && lastSession.completedTimer === completedTimer && lastSession.reason === reason) {
    return;
  }

  state.data.sessions.push({
    id: createId(),
    taskId: task.id,
    taskName: task.name,
    category: taskCategory(task),
    date: task.date,
    createdAt: now,
    plannedMinutes: task.plannedMinutes,
    elapsedSeconds: task.elapsedSeconds,
    elapsedMinutes,
    completedTimer,
    reason,
  });
}

export function startTicker() {
  if (tickHandle) return;
  lastTickSaveAt = Date.now();
  tickHandle = window.setInterval(() => {
    const wasActive = Boolean(activeTask());
    syncRunningTask();

    // No running task anymore: the countdown hit zero (state change ->
    // status complete) or the timer was paused. Persist + full render so
    // the dashboard/calendar reflect the change, then stop ticking.
    if (!activeTask()) {
      if (wasActive) saveAndRender();
      stopTicker();
      return;
    }

    // Normal second: only the countdown / active-focus / clock hand move.
    // Render those cheaply; throttle the localStorage write so we don't
    // JSON.stringify the whole DB every second.
    renderTick();
    if (Date.now() - lastTickSaveAt >= TICK_SAVE_MS) {
      saveData();
      lastTickSaveAt = Date.now();
    }
  }, 1000);
}

export function stopTicker() {
  if (!tickHandle) return;
  window.clearInterval(tickHandle);
  tickHandle = null;
}

/* ------------------------------- task CRUD ------------------------------- */

function resolveScheduledStart(dateKey, explicitTime, gapMinutes) {
  if (explicitTime) {
    return combineDateAndTime(dateKey, explicitTime);
  }

  const safeGapMinutes = Number.isFinite(gapMinutes) ? Math.max(0, gapMinutes) : 10;
  const latestEnd = state.data.tasks
    .filter((task) => task.date === dateKey)
    .map((task) => taskTimeWindow(task).end.getTime())
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];

  if (latestEnd) {
    return new Date(latestEnd + safeGapMinutes * 60 * 1000);
  }

  if (dateKey === todayKey()) {
    return new Date();
  }

  return combineDateAndTime(dateKey, "08:00");
}

export function addTask(name, plannedMinutes, category, scheduledDate, scheduledTime, gapMinutes) {
  const seconds = plannedMinutes * 60;
  const normalizedCategory = normalizeCategory(category);
  if (normalizedCategory) {
    state.data.categories = normalizeCategories([...(state.data.categories || []), normalizedCategory]);
  }
  const date = scheduledDate || todayKey();
  const scheduledStart = resolveScheduledStart(date, scheduledTime, gapMinutes);
  const scheduledEnd = new Date(scheduledStart.getTime() + plannedMinutes * 60 * 1000);

  state.data.tasks.unshift({
    id: createId(),
    name,
    category: normalizedCategory,
    plannedMinutes,
    date,
    status: "idle",
    remainingSeconds: seconds,
    elapsedSeconds: 0,
    lastStartedAt: null,
    firstStartedAt: null,
    endedAt: null,
    scheduledStartAt: scheduledStart.toISOString(),
    scheduledEndAt: scheduledEnd.toISOString(),
    rating: null,
    createdAt: scheduledStart.toISOString(),
    completedAt: null,
    archived: false,
  });
  saveAndRender();
}

export function updateTask(taskId, { name, plannedMinutes, category, scheduledDate, scheduledTime }) {
  const task = state.data.tasks.find((item) => item.id === taskId);
  if (!task) return;

  const normalizedCategory = normalizeCategory(category);
  if (normalizedCategory) {
    state.data.categories = normalizeCategories([...(state.data.categories || []), normalizedCategory]);
  }

  const date = scheduledDate || task.date;
  const previousStart = new Date(task.scheduledStartAt || task.createdAt || Date.now());
  const explicitTime = scheduledTime || formatTimeInput(previousStart);
  const scheduledStart = combineDateAndTime(date, explicitTime);
  const scheduledEnd = new Date(scheduledStart.getTime() + plannedMinutes * 60 * 1000);

  task.name = name;
  task.category = normalizedCategory;
  task.plannedMinutes = plannedMinutes;
  task.date = date;
  task.scheduledStartAt = scheduledStart.toISOString();
  task.scheduledEndAt = scheduledEnd.toISOString();
  if (task.status !== "complete") {
    task.remainingSeconds = Math.max(0, plannedMinutes * 60 - task.elapsedSeconds);
  }

  state.data.sessions.forEach((session) => {
    if (session.taskId === taskId) {
      session.taskName = name;
      session.category = normalizedCategory || "Chưa phân loại";
    }
  });

  saveAndRender();
}

// Drag-drop reschedule from the week calendar: move a task to a new day
// and start minute, snapped to 5 minutes, keeping its planned duration.
export function rescheduleTask(taskId, newDateKey, startMinute) {
  const task = state.data.tasks.find((item) => item.id === taskId);
  if (!task) return;

  const snapped = Math.max(0, Math.min(1435, Math.round(startMinute / 5) * 5));
  const hh = String(Math.floor(snapped / 60)).padStart(2, "0");
  const mm = String(snapped % 60).padStart(2, "0");
  const start = combineDateAndTime(newDateKey, `${hh}:${mm}`);
  const end = new Date(start.getTime() + task.plannedMinutes * 60 * 1000);

  task.date = newDateKey;
  task.scheduledStartAt = start.toISOString();
  task.scheduledEndAt = end.toISOString();
  saveAndRender();
}

export function startTask(taskId) {
  syncRunningTask();
  const task = state.data.tasks.find((item) => item.id === taskId);
  if (!task || task.status === "complete") return;
  if (task.date !== todayKey()) return;

  const blocker = lockedTask();
  if (blocker && blocker.id !== taskId) {
    ui.startBlockMessage = `Bạn cần hoàn thành "${blocker.name}" trước khi bắt đầu task khác.`;
    render();
    window.setTimeout(() => {
      ui.startBlockMessage = "";
      render();
    }, 3600);
    return;
  }

  unlockAudio();
  if (!ensureSingleTimer(taskId)) return;
  if (!task.firstStartedAt) {
    task.firstStartedAt = new Date().toISOString();
  }
  task.status = "running";
  task.lastStartedAt = Date.now();
  saveAndRender();
  startTicker();
}

export function pauseTask(taskId) {
  syncRunningTask();
  const task = state.data.tasks.find((item) => item.id === taskId);
  if (!task || task.status !== "running") return;

  task.status = "paused";
  task.lastStartedAt = null;
  addSession(task, false, "paused");
  saveAndRender();
}

export function finishTaskEarly(taskId) {
  syncRunningTask();
  const task = state.data.tasks.find((item) => item.id === taskId);
  if (!task || task.status === "complete" || task.status === "idle") return;

  const now = new Date().toISOString();
  if (!task.firstStartedAt) {
    task.firstStartedAt = now;
  }
  task.status = "complete";
  task.completedAt = now;
  task.endedAt = now;
  task.lastStartedAt = null;
  task.remainingSeconds = Math.max(0, task.plannedMinutes * 60 - task.elapsedSeconds);
  addSession(task, false, "earlyFinish");
  saveAndRender();
}

export function resetTask(taskId) {
  syncRunningTask();
  const task = state.data.tasks.find((item) => item.id === taskId);
  if (!task || task.status === "complete") return;

  task.status = "idle";
  task.remainingSeconds = task.plannedMinutes * 60;
  task.elapsedSeconds = 0;
  task.lastStartedAt = null;
  saveAndRender();
}

export function toggleComplete(taskId) {
  syncRunningTask();
  const task = state.data.tasks.find((item) => item.id === taskId);
  if (!task) return;

  if (task.status === "complete") {
    task.status = "idle";
    task.completedAt = null;
    task.endedAt = null;
    task.rating = null;
  } else {
    if (!task.firstStartedAt) {
      task.firstStartedAt = new Date().toISOString();
    }
    task.status = "complete";
    task.completedAt = new Date().toISOString();
    task.endedAt = task.completedAt;
    task.lastStartedAt = null;
    addSession(task, false, "manualComplete");
  }
  saveAndRender();
}

export function setRating(taskId, rating) {
  const task = state.data.tasks.find((item) => item.id === taskId);
  if (!task || task.status !== "complete") return;
  task.rating = rating;
  saveAndRender();
}

export function deleteTask(taskId) {
  syncRunningTask();
  const task = state.data.tasks.find((item) => item.id === taskId);
  if (!task) return;

  const hasWorkData = task.elapsedSeconds > 0 || task.status === "running" || task.status === "paused" || task.status === "complete";
  if (hasWorkData && !window.confirm(`Xóa "${task.name}" và toàn bộ lịch sử focus của task này?`)) {
    return;
  }

  const wasRunning = state.data.tasks.some((item) => item.id === taskId && item.status === "running");
  state.data.tasks = state.data.tasks.filter((item) => item.id !== taskId);
  state.data.sessions = state.data.sessions.filter((session) => session.taskId !== taskId);
  if (wasRunning) {
    stopTicker();
  }
  saveAndRender();
}

export function clearCompletedToday() {
  state.data.tasks.forEach((task) => {
    if (task.date === ui.taskBoardDate && task.status === "complete") {
      task.archived = true;
    }
  });
  saveAndRender();
}
