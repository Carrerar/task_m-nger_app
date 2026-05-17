import { state } from "../core/store.js";
import { ui } from "../core/ui-state.js";
import { render } from "../core/bus.js";
import { elements } from "../core/dom.js";
import { formatTimeInput } from "../core/time.js";
import { knownCategories, analysisCategories } from "../core/selectors.js";
import { syncRunningTask } from "./tasks.js";

export function renderCategoryControls() {
  const categories = knownCategories();
  const filterCategories = analysisCategories();
  const currentStillExists = ui.selectedCategory === "all" || filterCategories.includes(ui.selectedCategory);
  if (!currentStillExists) {
    ui.selectedCategory = "all";
  }

  const selectedTaskCategory = elements.taskCategory.value;
  elements.taskCategory.innerHTML = '<option value="">Chưa phân loại</option>';
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    elements.taskCategory.append(option);
  });
  if (selectedTaskCategory && categories.includes(selectedTaskCategory)) {
    elements.taskCategory.value = selectedTaskCategory;
  }

  elements.deleteCategorySelect.innerHTML = '<option value="">Chọn loại để xóa</option>';
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    elements.deleteCategorySelect.append(option);
  });
  elements.deleteCategoryButton.disabled = !elements.deleteCategorySelect.value;

  elements.categoryFilter.innerHTML = '<option value="all">Tất cả công việc</option>';
  filterCategories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    elements.categoryFilter.append(option);
  });
  elements.categoryFilter.value = ui.selectedCategory;
}

export function renderComposer() {
  const editingTask = ui.editingTaskId
    ? state.data.tasks.find((task) => task.id === ui.editingTaskId)
    : null;
  if (ui.editingTaskId && !editingTask) {
    ui.editingTaskId = null;
  }
  const isEditing = Boolean(ui.editingTaskId);

  elements.taskComposer.hidden = !ui.composerOpen;
  elements.toggleComposerButton.textContent = ui.composerOpen ? "Thu gọn" : "Thêm công việc";
  elements.toggleComposerButton.setAttribute("aria-expanded", String(ui.composerOpen));
  elements.editBanner.hidden = !isEditing;
  if (isEditing) {
    elements.editBannerName.textContent = editingTask.name;
  }
  elements.taskSubmitButton.textContent = isEditing ? "Lưu thay đổi" : "Thêm task";
  elements.taskRepeat.disabled = isEditing;
}

export function startEditTask(taskId) {
  syncRunningTask();
  const task = state.data.tasks.find((item) => item.id === taskId);
  if (!task) return;
  if (task.status === "running") {
    window.alert("Tạm dừng task trước khi sửa.");
    return;
  }

  ui.editingTaskId = taskId;
  ui.composerOpen = true;
  const start = new Date(task.scheduledStartAt || task.createdAt || Date.now());
  elements.taskName.value = task.name;
  elements.taskMinutes.value = task.plannedMinutes;
  elements.taskDate.value = task.date;
  elements.taskStartTime.value = formatTimeInput(start);
  elements.taskRepeat.value = "none";
  renderCategoryControls();
  elements.taskCategory.value = task.category || "";
  render();
  elements.taskComposer.scrollIntoView({ behavior: "smooth", block: "nearest" });
  elements.taskName.focus();
}

export function cancelEdit() {
  ui.editingTaskId = null;
  elements.taskForm.reset();
  elements.taskMinutes.value = "25";
  elements.taskDate.value = ui.taskBoardDate;
  elements.taskStartTime.value = "";
  render();
}
