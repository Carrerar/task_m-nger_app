import { state } from "../core/store.js";
import { saveAndRender } from "../core/bus.js";
import { elements } from "../core/dom.js";
import { ui } from "../core/ui-state.js";
import { RECURRENCE_LABEL, WEEKDAY_LABEL } from "../core/constants.js";
import { createId, normalizeCategory, normalizeCategories } from "../core/utils.js";
import { todayKey, parseDateKey, addDays, combineDateAndTime } from "../core/time.js";

// How far ahead recurring templates are materialised so daily/weekly tasks
// show up on future days (calendar + day board), not just today.
const MATERIALIZE_DAYS_AHEAD = 60;

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
    note: template.note || "",
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

// Materialise every active template from today through the horizon. Kept
// the name/signature/return so callers (init + day-change) are unchanged.
export function applyRecurringToday() {
  const templates = (state.data.recurring || []).filter((template) => template.active !== false);
  if (!templates.length) return false;

  const existing = new Set();
  state.data.tasks.forEach((task) => {
    if (task.recurringId) existing.add(`${task.recurringId}__${task.date}`);
  });

  const start = parseDateKey(todayKey());
  let created = false;
  for (let offset = 0; offset <= MATERIALIZE_DAYS_AHEAD; offset += 1) {
    const date = addDays(start, offset);
    const key = todayKey(date);
    templates.forEach((template) => {
      if (!recurrenceAppliesOn(template, date)) return;
      if (existing.has(`${template.id}__${key}`)) return;
      createTaskFromTemplate(template, key);
      existing.add(`${template.id}__${key}`);
      created = true;
    });
  }
  return created;
}

export function addRecurring({ name, plannedMinutes, category, startTime, type, weekday, note }) {
  const normalizedCategory = normalizeCategory(category);
  if (normalizedCategory) {
    state.data.categories = normalizeCategories([...(state.data.categories || []), normalizedCategory]);
  }
  state.data.recurring = state.data.recurring || [];
  state.data.recurring.push({
    id: createId(),
    name,
    note: (note || "").trim(),
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
  if (templates.length === 0) return;

  elements.recurringCollapseBtn.textContent = ui.recurringCollapsed ? "Mở rộng" : "Thu gọn";
  elements.recurringList.hidden = ui.recurringCollapsed;
  if (ui.recurringCollapsed) return;

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
