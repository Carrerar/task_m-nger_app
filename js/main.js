import { state, saveData, onAfterSave } from "./core/store.js";
import { ui } from "./core/ui-state.js";
import { setRenderer, setTickRenderer, render } from "./core/bus.js";
import { elements } from "./core/dom.js";
import { todayKey, parseDateKey } from "./core/time.js";
import { activeTask } from "./core/selectors.js";
import {
  addTask,
  updateTask,
  clearCompletedToday,
  startTicker,
  syncRunningTask,
} from "./features/tasks.js";
import { addRecurring, applyRecurringToday, renderRecurringList } from "./features/recurring.js";
import { addCategory, deleteCategory } from "./features/categories.js";
import {
  renderCategoryControls,
  renderComposer,
  startEditTask,
  cancelEdit,
} from "./features/composer.js";
import { renderTasks, renderActiveFocus } from "./ui/render.js";
import { renderDashboard, renderClockNow } from "./features/dashboard.js";
import { renderCalendar, shiftPeriod, goToToday, setCalendarView } from "./features/calendar.js";
import { initTrain } from "./ui/train.js";
import { exportData, importData } from "./features/io.js";
import {
  getSyncConfig,
  setSyncConfig,
  syncEnabled,
  syncStatus,
  onSyncStatus,
  pull,
  schedulePush,
} from "./features/sync.js";

function formatDateLabel() {
  const formatter = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  elements.todayLabel.textContent = formatter.format(new Date());
}

function fullRender() {
  renderCategoryControls();
  renderComposer();
  renderRecurringList();
  renderCalendar();
  renderTasks();
  renderActiveFocus();
  renderDashboard();
}

setRenderer(fullRender);

// Cheap per-second update used by the timer ticker: only the parts that
// actually change every second. Other panels refresh on the next state
// change or the 60s heartbeat.
function tickRender() {
  renderTasks();
  renderActiveFocus();
  renderClockNow();
}

setTickRenderer(tickRender);

/* ------------------------------- events ------------------------------- */

elements.taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = elements.taskName.value.trim();
  const plannedMinutes = Number.parseInt(elements.taskMinutes.value, 10);
  const scheduledDate = elements.taskDate.value || todayKey();
  const scheduledTime = elements.taskStartTime.value;
  const category = elements.taskCategory.value;
  const repeat = elements.taskRepeat.value;
  const note = elements.taskNote.value;
  if (!name || !Number.isFinite(plannedMinutes) || plannedMinutes < 1) return;

  const wasEditing = Boolean(ui.editingTaskId);
  if (wasEditing) {
    updateTask(ui.editingTaskId, { name, plannedMinutes, category, scheduledDate, scheduledTime, note });
    ui.editingTaskId = null;
  } else if (repeat && repeat !== "none") {
    addRecurring({
      name,
      plannedMinutes,
      category,
      startTime: scheduledTime,
      type: repeat,
      weekday: parseDateKey(scheduledDate).getDay(),
      note,
    });
  } else {
    addTask(name, plannedMinutes, category, scheduledDate, scheduledTime, note);
  }

  const boardTarget = !wasEditing && repeat && repeat !== "none" ? todayKey() : scheduledDate;
  ui.taskBoardDate = boardTarget;
  elements.taskBoardDate.value = boardTarget;
  elements.historyDate.value = boardTarget;
  elements.taskName.value = "";
  elements.taskMinutes.value = "25";
  elements.taskStartTime.value = "";
  elements.taskNote.value = "";
  elements.taskRepeat.value = "none";
  elements.taskName.focus();
  render();
});

elements.calendarMonthBtn.addEventListener("click", () => setCalendarView("month"));
elements.calendarWeekBtn.addEventListener("click", () => setCalendarView("week"));
elements.calendarPrev.addEventListener("click", () => shiftPeriod(-1));
elements.calendarNext.addEventListener("click", () => shiftPeriod(1));
elements.calendarToday.addEventListener("click", goToToday);
elements.clearCompletedButton.addEventListener("click", clearCompletedToday);
elements.exportButton.addEventListener("click", exportData);
elements.importButton.addEventListener("click", () => elements.importFile.click());
elements.importFile.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) importData(file);
  event.target.value = "";
});
const SYNC_STATUS_TEXT = {
  off: "",
  syncing: "Đang đồng bộ…",
  ok: "Đã đồng bộ ✓",
  error: "Lỗi đồng bộ — bấm để thử lại",
};

function renderSyncStatus(status) {
  const enabled = syncEnabled();
  elements.syncStatus.hidden = !enabled;
  elements.syncButton.textContent = enabled ? "Đồng bộ ngay" : "Đồng bộ thiết bị";
  if (!enabled) return;
  elements.syncStatus.textContent = SYNC_STATUS_TEXT[status] || "";
  elements.syncStatus.dataset.state = status;
}

onSyncStatus(renderSyncStatus);
onAfterSave(schedulePush);

async function syncNow() {
  const adopted = await pull();
  if (!adopted) return;
  render();
  if (activeTask()) startTicker();
}

function configureSync() {
  const current = getSyncConfig();
  const url = window.prompt(
    "URL của Worker đồng bộ (ví dụ https://focus-board-sync.<tên>.workers.dev):",
    current.url,
  );
  if (url === null) return;
  const token = window.prompt("Mã bí mật chung (SYNC_TOKEN) — giống nhau cho mọi người:", current.token);
  if (token === null) return;
  const room = window.prompt(
    "Mã phòng riêng của bạn (chuỗi dài, ngẫu nhiên — đây là khóa bảng riêng; dùng y hệt trên các thiết bị của bạn):",
    current.room,
  );
  if (room === null) return;
  setSyncConfig(url, token, room);
  renderSyncStatus(syncStatus());
  if (syncEnabled()) syncNow();
}

elements.syncButton.addEventListener("click", (event) => {
  if (event.shiftKey || !syncEnabled()) {
    configureSync();
  } else {
    syncNow();
  }
});

elements.cancelEditButton.addEventListener("click", cancelEdit);
elements.taskBoardDate.addEventListener("change", () => {
  ui.taskBoardDate = elements.taskBoardDate.value || todayKey();
  elements.taskDate.value = ui.taskBoardDate;
  render();
});
elements.toggleComposerButton.addEventListener("click", () => {
  ui.composerOpen = !ui.composerOpen;
  if (!ui.composerOpen && ui.editingTaskId) {
    cancelEdit();
    return;
  }
  if (ui.composerOpen && !elements.taskDate.value) {
    elements.taskDate.value = ui.taskBoardDate;
  }
  renderComposer();
  if (ui.composerOpen) {
    elements.taskName.focus();
  }
});
elements.addCategoryButton.addEventListener("click", () => addCategory(elements.newCategoryName.value));
elements.newCategoryName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addCategory(elements.newCategoryName.value);
  }
});
elements.deleteCategorySelect.addEventListener("change", () => {
  elements.deleteCategoryButton.disabled = !elements.deleteCategorySelect.value;
});
elements.deleteCategoryButton.addEventListener("click", () => deleteCategory(elements.deleteCategorySelect.value));
elements.categoryFilter.addEventListener("change", () => {
  ui.selectedCategory = elements.categoryFilter.value;
  renderDashboard();
});
elements.historyRange.addEventListener("change", renderDashboard);
elements.historyDate.addEventListener("change", renderDashboard);

window.setInterval(() => {
  const currentDay = todayKey();
  if (currentDay !== ui.materializedDay) {
    ui.materializedDay = currentDay;
    formatDateLabel();
    applyRecurringToday();
    saveData();
    render();
    return;
  }
  if (!activeTask()) {
    renderDashboard();
  }
}, 60000);

window.addEventListener("beforeunload", () => {
  syncRunningTask();
  saveData();
});

// Saves are throttled while the timer ticks, so flush whenever the page is
// backgrounded — covers PWA/mobile closes where beforeunload may not fire.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    syncRunningTask();
    saveData();
  } else if (document.visibilityState === "visible" && syncEnabled()) {
    // Coming back to the tab/PWA: another device may have moved ahead.
    syncNow();
  }
});

/* -------------------------------- init -------------------------------- */

formatDateLabel();
elements.taskDate.value = todayKey();
elements.taskBoardDate.value = todayKey();
elements.historyDate.value = todayKey();
if (applyRecurringToday()) {
  saveData();
}
render();
if (activeTask()) {
  startTicker();
}
initTrain();

renderSyncStatus(syncStatus());
if (syncEnabled()) syncNow();
