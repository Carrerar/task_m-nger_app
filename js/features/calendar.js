import { state } from "../core/store.js";
import { ui } from "../core/ui-state.js";
import { render } from "../core/bus.js";
import { elements } from "../core/dom.js";
import { todayKey, monthKey, parseDateKey, addDays, startOfWeek, formatTime } from "../core/time.js";
import { taskCategory, taskColor, scheduledWindow } from "../core/selectors.js";
import { rescheduleTask } from "./tasks.js";

const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const MAX_CHIPS = 3;
const HOUR_HEIGHT = 52;
const MIN_BLOCK_HEIGHT = 22;
const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 22;

function monthLabel(year, monthIndex) {
  return new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" })
    .format(new Date(year, monthIndex, 1));
}

function weekLabel(start, end) {
  const fmt = new Intl.DateTimeFormat("vi-VN", { day: "numeric", month: "short", year: "numeric" });
  if (typeof fmt.formatRange === "function") return fmt.formatRange(start, end);
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

function tasksByDate() {
  const map = new Map();
  // "Ẩn task xong" only hides archived tasks from the checklist; the calendar
  // still shows them so the day's full schedule stays visible.
  state.data.tasks
    .forEach((task) => {
      if (!map.has(task.date)) map.set(task.date, []);
      map.get(task.date).push(task);
    });
  for (const list of map.values()) {
    list.sort((a, b) => scheduledWindow(a).start - scheduledWindow(b).start);
  }
  return map;
}

function selectDate(dateKey) {
  ui.taskBoardDate = dateKey;
  ui.calendarMonth = dateKey.slice(0, 7);
  ui.calendarWeekStart = todayKey(startOfWeek(parseDateKey(dateKey)));
  elements.taskBoardDate.value = dateKey;
  elements.taskDate.value = dateKey;
  elements.historyDate.value = dateKey;
  render();
  elements.taskList.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/* ------------------------------- month view ------------------------------- */

function buildChip(task) {
  const chip = document.createElement("span");
  chip.className = `calendar-chip${task.status === "complete" ? " is-complete" : ""}`;
  chip.style.background = taskColor(task, 0);
  chip.textContent = task.name;
  chip.title = `${task.name} · ${taskCategory(task)} · ${task.plannedMinutes} phút`;
  return chip;
}

function renderMonth() {
  const [year, monthIndex] = ui.calendarMonth.split("-").map(Number);
  const safeMonthIndex = monthIndex - 1;
  elements.calendarMonthLabel.textContent = monthLabel(year, safeMonthIndex);

  elements.calendarWeekdays.innerHTML = "";
  WEEKDAY_SHORT.forEach((label) => {
    const cell = document.createElement("span");
    cell.textContent = label;
    elements.calendarWeekdays.append(cell);
  });

  const first = new Date(year, safeMonthIndex, 1);
  const gridStart = addDays(first, -first.getDay());
  const byDate = tasksByDate();
  const today = todayKey();

  elements.calendarGrid.innerHTML = "";
  for (let i = 0; i < 42; i += 1) {
    const cellDate = addDays(gridStart, i);
    const key = todayKey(cellDate);
    const inMonth = cellDate.getMonth() === safeMonthIndex;
    const tasks = byDate.get(key) || [];

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "calendar-cell";
    cell.classList.toggle("is-outside", !inMonth);
    cell.classList.toggle("is-today", key === today);
    cell.classList.toggle("is-selected", key === ui.taskBoardDate);
    cell.addEventListener("click", () => selectDate(key));

    const head = document.createElement("span");
    head.className = "calendar-day-number";
    head.textContent = String(cellDate.getDate());
    cell.append(head);

    const chips = document.createElement("span");
    chips.className = "calendar-chips";
    tasks.slice(0, MAX_CHIPS).forEach((task) => chips.append(buildChip(task)));
    if (tasks.length > MAX_CHIPS) {
      const more = document.createElement("span");
      more.className = "calendar-more";
      more.textContent = `+${tasks.length - MAX_CHIPS} nữa`;
      chips.append(more);
    }
    cell.append(chips);
    elements.calendarGrid.append(cell);
  }
}

/* ------------------------------- week view -------------------------------- */

// Greedy lane assignment so overlapping blocks sit side by side.
function assignLanes(items) {
  const sorted = items.slice().sort((a, b) => a.start - b.start);
  let cluster = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const laneEnds = [];
    cluster.forEach((it) => {
      let lane = laneEnds.findIndex((end) => end <= it.start);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(it.end);
      } else {
        laneEnds[lane] = it.end;
      }
      it.lane = lane;
    });
    cluster.forEach((it) => { it.laneCount = laneEnds.length; });
    cluster = [];
    clusterEnd = -Infinity;
  };

  sorted.forEach((it) => {
    if (cluster.length && it.start >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.end);
  });
  if (cluster.length) flush();
  return sorted;
}

// Pointer-drag a week block to a new day/time. A small move threshold
// keeps a plain click working as "select that day". Drop is resolved by
// hit-testing the column under the pointer; the grab offset is preserved
// so the block's top edge lands where the user expects.
function attachBlockDrag(block, sourceKey, task, startHour) {
  let startX = 0;
  let startY = 0;
  let grabOffset = 0;
  let dragging = false;
  let pointerId = null;

  block.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    grabOffset = event.clientY - block.getBoundingClientRect().top;
    dragging = false;
    block._dragged = false;
    block.setPointerCapture(pointerId);
  });

  block.addEventListener("pointermove", (event) => {
    if (pointerId === null) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (!dragging && Math.hypot(dx, dy) > 4) {
      dragging = true;
      block.classList.add("is-dragging");
    }
    if (dragging) {
      block.style.transform = `translate(${dx}px, ${dy}px)`;
    }
  });

  const finish = (event) => {
    if (pointerId === null) return;
    const wasDragging = dragging;
    try { block.releasePointerCapture(pointerId); } catch { /* already released */ }
    pointerId = null;
    dragging = false;
    block.style.transform = "";
    block.classList.remove("is-dragging");
    if (!wasDragging) return; // a plain tap -> let the click handler select

    block._dragged = true; // suppress the trailing click
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const col = target && target.closest ? target.closest(".cw-col") : null;
    if (!col || !col.dataset.dateKey) {
      render(); // dropped outside a day column: snap back
      return;
    }
    const rect = col.getBoundingClientRect();
    const topPx = event.clientY - rect.top - grabOffset;
    const minute = startHour * 60 + (topPx / HOUR_HEIGHT) * 60;
    rescheduleTask(task.id, col.dataset.dateKey, minute);
  };

  block.addEventListener("pointerup", finish);
  block.addEventListener("pointercancel", () => {
    if (pointerId !== null) {
      try { block.releasePointerCapture(pointerId); } catch { /* noop */ }
    }
    pointerId = null;
    dragging = false;
    block.style.transform = "";
    block.classList.remove("is-dragging");
  });

  block.addEventListener("click", () => {
    if (block._dragged) {
      block._dragged = false;
      return;
    }
    selectDate(sourceKey);
  });
}

function renderWeek() {
  const weekStart = parseDateKey(ui.calendarWeekStart);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = days[6];
  elements.calendarMonthLabel.textContent = weekLabel(weekStart, weekEnd);

  const byDate = tasksByDate();
  const today = todayKey();
  const now = new Date();

  // Per-day blocks + adaptive hour range.
  let startHour = DEFAULT_START_HOUR;
  let endHour = DEFAULT_END_HOUR;
  const perDay = days.map((day) => {
    const key = todayKey(day);
    const items = (byDate.get(key) || []).map((task) => {
      const { start, end } = scheduledWindow(task);
      const startMin = start.getHours() * 60 + start.getMinutes();
      const endMin = Math.max(startMin + 1, end.getHours() * 60 + end.getMinutes());
      startHour = Math.min(startHour, Math.floor(startMin / 60));
      endHour = Math.max(endHour, Math.ceil(endMin / 60));
      return { task, start: startMin, end: endMin };
    });
    return { key, items: assignLanes(items) };
  });
  startHour = Math.max(0, startHour);
  endHour = Math.min(24, Math.max(endHour, startHour + 1));
  const rows = endHour - startHour;
  const bodyHeight = rows * HOUR_HEIGHT;

  const root = elements.calendarWeek;
  root.innerHTML = "";

  const head = document.createElement("div");
  head.className = "cw-head";
  head.append(document.createElement("span")); // gutter spacer
  days.forEach((day) => {
    const key = todayKey(day);
    const col = document.createElement("button");
    col.type = "button";
    col.className = "cw-dayhead";
    col.classList.toggle("is-today", key === today);
    col.classList.toggle("is-selected", key === ui.taskBoardDate);
    col.addEventListener("click", () => selectDate(key));
    col.innerHTML = `<span class="cw-dow">${WEEKDAY_SHORT[day.getDay()]}</span>`;
    const num = document.createElement("strong");
    num.textContent = String(day.getDate());
    col.append(num);
    head.append(col);
  });
  root.append(head);

  const body = document.createElement("div");
  body.className = "cw-body";
  body.style.height = `${bodyHeight}px`;

  const times = document.createElement("div");
  times.className = "cw-times";
  for (let h = startHour; h < endHour; h += 1) {
    const slot = document.createElement("span");
    slot.style.height = `${HOUR_HEIGHT}px`;
    slot.textContent = `${String(h).padStart(2, "0")}:00`;
    times.append(slot);
  }
  body.append(times);

  perDay.forEach(({ key, items }) => {
    const col = document.createElement("div");
    col.className = "cw-col";
    col.dataset.dateKey = key;
    col.style.backgroundSize = `100% ${HOUR_HEIGHT}px`;

    items.forEach(({ task, start, end, lane, laneCount }) => {
      const top = ((start - startHour * 60) / 60) * HOUR_HEIGHT;
      const height = Math.max(MIN_BLOCK_HEIGHT, ((end - start) / 60) * HOUR_HEIGHT);
      const width = 100 / laneCount;
      const block = document.createElement("button");
      block.type = "button";
      block.className = `cw-block${task.status === "complete" ? " is-complete" : ""}`;
      block.style.top = `${top}px`;
      block.style.height = `${height - 2}px`;
      block.style.left = `${lane * width}%`;
      block.style.width = `calc(${width}% - 3px)`;
      block.style.background = taskColor(task, 0);
      block.title = `${task.name} · ${taskCategory(task)} · kéo để đổi lịch`;
      if (height >= HOUR_HEIGHT) block.classList.add("is-tall");
      attachBlockDrag(block, key, task, startHour);
      const name = document.createElement("span");
      name.className = "cw-block-name";
      name.textContent = task.name;
      const time = document.createElement("span");
      time.className = "cw-block-time";
      const win = scheduledWindow(task);
      time.textContent = `${formatTime(win.start)}–${formatTime(win.end)}`;
      block.append(name, time);
      if (task.note) {
        const noteEl = document.createElement("span");
        noteEl.className = "cw-block-note";
        noteEl.textContent = task.note;
        block.append(noteEl);
      }
      col.append(block);
    });

    if (key === today && now >= weekStart && now <= addDays(weekEnd, 1)) {
      const nowMin = now.getHours() * 60 + now.getMinutes();
      if (nowMin >= startHour * 60 && nowMin <= endHour * 60) {
        const line = document.createElement("div");
        line.className = "cw-now";
        line.style.top = `${((nowMin - startHour * 60) / 60) * HOUR_HEIGHT}px`;
        col.append(line);
      }
    }
    body.append(col);
  });

  root.append(body);
}

/* --------------------------------- API ----------------------------------- */

export function renderCalendar() {
  const isWeek = ui.calendarView === "week";
  elements.calendarTitle.textContent = isWeek ? "Lịch tuần" : "Lịch tháng";
  elements.calendarMonthBtn.classList.toggle("is-active", !isWeek);
  elements.calendarWeekBtn.classList.toggle("is-active", isWeek);
  elements.calendarMonthView.hidden = isWeek;
  elements.calendarWeek.hidden = !isWeek;
  if (isWeek) renderWeek();
  else renderMonth();
}

export function setCalendarView(view) {
  if (ui.calendarView === view) return;
  ui.calendarView = view;
  renderCalendar();
}

export function shiftPeriod(delta) {
  if (ui.calendarView === "week") {
    ui.calendarWeekStart = todayKey(addDays(parseDateKey(ui.calendarWeekStart), delta * 7));
  } else {
    const [year, monthIndex] = ui.calendarMonth.split("-").map(Number);
    ui.calendarMonth = monthKey(new Date(year, monthIndex - 1 + delta, 1));
  }
  renderCalendar();
}

export function goToToday() {
  ui.calendarMonth = monthKey();
  ui.calendarWeekStart = todayKey(startOfWeek());
  selectDate(todayKey());
}
