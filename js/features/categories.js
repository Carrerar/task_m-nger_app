import { state } from "../core/store.js";
import { ui } from "../core/ui-state.js";
import { saveAndRender } from "../core/bus.js";
import { elements } from "../core/dom.js";
import { normalizeCategory, normalizeCategories } from "../core/utils.js";

export function addCategory(name) {
  const normalizedCategory = normalizeCategory(name);
  if (!normalizedCategory) return;
  state.data.categories = normalizeCategories([...(state.data.categories || []), normalizedCategory]);
  elements.newCategoryName.value = "";
  saveAndRender();
  elements.taskCategory.value = normalizedCategory;
}

export function deleteCategory(name) {
  const normalizedCategory = normalizeCategory(name);
  if (!normalizedCategory) return;

  const affectedTasks = state.data.tasks.filter((task) => task.category === normalizedCategory).length;
  const message = affectedTasks
    ? `Xóa loại "${normalizedCategory}"? ${affectedTasks} task cũ sẽ chuyển về Chưa phân loại.`
    : `Xóa loại "${normalizedCategory}"?`;
  if (!window.confirm(message)) return;

  state.data.categories = normalizeCategories((state.data.categories || []).filter((category) => category !== normalizedCategory));
  state.data.tasks.forEach((task) => {
    if (task.category === normalizedCategory) {
      task.category = "";
    }
  });
  state.data.sessions.forEach((session) => {
    if (session.category === normalizedCategory) {
      session.category = "Chưa phân loại";
    }
  });
  if (ui.selectedCategory === normalizedCategory) {
    ui.selectedCategory = "all";
  }
  saveAndRender();
}
