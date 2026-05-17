import { state } from "../core/store.js";
import { saveAndRender } from "../core/bus.js";
import { elements } from "../core/dom.js";
import { RECURRENCE_LABEL, WEEKDAY_LABEL } from "../core/constants.js";
import { createId, normalizeCategory, normalizeCategories } from "../core/utils.js";
import { todayKey, parseDateKey, combineDateAndTime } from "../core/time.js";

function recurrenceAppliesOn(template, date) {
  const dayOfWeek = date.getDay();
  if (template.type === "daily") return true;
  if (template.type === "weekdays") return dayOfWeek >= 1 && dayOfWeek <= 5;
  if (template.type === "weekly") return dayOfWeek === template.weekday;
  return false;
}

function createTaskFromTemplate(template, dateKey) {
  const start = combineDateAndTime(dateKey, template.startTime || "08:00");
  const end = new Date(start.getTime() + template.plannedMinutes * 60 * 1000);
  state.data.tasks.unshift({
    id: createId(),
    recurringId: template.id,
    name: template.name,
    category: template.category || "",
    plannedMinutes: template.plannedMinutes,
    date: dateKey,
    status: "idle",
    remainingSeconds: template.plannedMinutes * 60,
    elapsedSeconds: 0,
    lastStartedAt: null,
    firstStartedAt: null,
    endedAt: null,
    scheduledStartAt: start.toISOString(),
    scheduledEndAt: end.toISOString(),
    rating: null,
    createdAt: start.toISOString(),
    completedAt: null,
    archived: false,
  });
}

export function applyRecurringToday() {
  const key = todayKey();
  const today = parseDateKey(key);
  let created = false;
  (state.data.recurring || []).forEach((template) => {
    if (template.active === false) return;
    if (!recurrenceAppliesOn(template, today)) return;
    const exists = state.data.tasks.some((task) => task.recurringId === template.id && task.date === key);
    if (exists) return;
    createTaskFromTemplate(template, key);
    created = true;
  });
  return created;
}

export function addRecurring({ name, plannedMinutes, category, startTime, type, weekday }) {
  const normalizedCategory = normalizeCategory(category);
  if (normalizedCategory) {
    state.data.categories = normalizeCategories([...(state.data.categories || []), normalizedCategory]);
  }
  state.data.recurring = state.data.recurring || [];
  state.data.recurring.push({
    id: createId(),
    name,
    plannedMinutes,
    category: normalizedCategory,
    startTime: startTime || "",
    type,
    weekday: Number.isFinite(weekday) ? weekday : new Date().getDay(),
    createdAt: new Date().toISOString(),
    active: true,
  });
  applyRecurringToday();
  saveAndRender();
}

function deleteRecurring(id) {
  const template = (state.data.recurring || []).find((item) => item.id === id);
  if (!template) return;
  if (!window.confirm(`Xóa lịch lặp "${template.name}"? Các task đã tạo trước đó vẫn được giữ lại.`)) {
    return;
  }
  state.data.recurring = (state.data.recurring || []).filter((item) => item.id !== id);
  saveAndRender();
}

function recurrenceSummary(template) {
  const base = template.type === "weekly"
    ? `${RECURRENCE_LABEL.weekly} (${WEEKDAY_LABEL[template.weekday] || "?"})`
    : RECURRENCE_LABEL[template.type] || template.type;
  const time = template.startTime ? ` · ${template.startTime}` : " · 08:00";
  return `${base}${time} · ${template.plannedMinutes} phút`;
}

export function renderRecurringList() {
  const templates = state.data.recurring || [];
  elements.recurringManager.hidden = templates.length === 0;
  elements.recurringList.innerHTML = "";
  templates.forEach((template) => {
    const item = document.createElement("div");
    item.className = "recurring-item";
    item.innerHTML = `
      <div>
        <strong></strong>
        <div><span></span></div>
      </div>
    `;
    item.querySelector("strong").textContent = template.name;
    item.querySelector("span").textContent = `${recurrenceSummary(template)}${template.category ? ` · ${template.category}` : ""}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Xóa lịch";
    remove.addEventListener("click", () => deleteRecurring(template.id));
    item.append(remove);
    elements.recurringList.append(item);
  });
}
