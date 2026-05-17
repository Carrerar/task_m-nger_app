import { state, saveData } from "./core/store.js";
import { ui } from "./core/ui-state.js";
import { setRenderer, render } from "./core/bus.js";
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
import { renderDashboard } from "./features/dashboard.js";
import { renderCalendar, shiftPeriod, goToToday, setCalendarView } from "./features/calendar.js";
import { initTrain } from "./ui/train.js";
import { exportData, importData } from "./features/io.js";

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

/* ------------------------------- events ------------------------------- */

elements.taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = elements.taskName.value.trim();
  const plannedMinutes = Number.parseInt(elements.taskMinutes.value, 10);
  const scheduledDate = elements.taskDate.value || todayKey();
  const scheduledTime = elements.taskStartTime.value;
  const gapMinutes = Number.parseInt(elements.taskGapMinutes.value, 10);
  const category = elements.taskCategory.value;
  const repeat = elements.taskRepeat.value;
  if (!name || !Number.isFinite(plannedMinutes) || plannedMinutes < 1) return;

  const wasEditing = Boolean(ui.editingTaskId);
  if (wasEditing) {
    updateTask(ui.editingTaskId, { name, plannedMinutes, category, scheduledDate, scheduledTime });
    ui.editingTaskId = null;
  } else if (repeat && repeat !== "none") {
    addRecurring({
      name,
      plannedMinutes,
      category,
      startTime: scheduledTime,
      type: repeat,
      weekday: parseDateKey(scheduledDate).getDay(),
    });
  } else {
    addTask(name, plannedMinutes, category, scheduledDate, scheduledTime, gapMinutes);
  }

  const boardTarget = !wasEditing && repeat && repeat !== "none" ? todayKey() : scheduledDate;
  ui.taskBoardDate = boardTarget;
  elements.taskBoardDate.value = boardTarget;
  elements.historyDate.value = boardTarget;
  elements.taskName.value = "";
  elements.taskMinutes.value = "25";
  elements.taskStartTime.value = "";
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
