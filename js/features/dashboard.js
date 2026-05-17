import { state } from "../core/store.js";
import { ui } from "../core/ui-state.js";
import { elements } from "../core/dom.js";
import { RATING_SCORE, RATING_LABEL } from "../core/constants.js";
import {
  todayKey,
  parseDateKey,
  addDays,
  formatTime,
  formatDateShort,
  formatDateLong,
  minuteOfDay,
  minutesLabel,
} from "../core/time.js";
import { escapeHtml } from "../core/utils.js";
import {
  todayTasks,
  categoryMatches,
  taskCategory,
  statusLabel,
  durationVarianceLabel,
  taskTimeWindow,
  taskColor,
  analysisCategories,
  scoreLabel,
  scheduleDriftLabel,
} from "../core/selectors.js";

export function renderDashboard() {
  const tasks = todayTasks().filter(categoryMatches);
  const completed = tasks.filter((task) => task.status === "complete");
  const rated = completed.filter((task) => task.rating);
  const highCount = rated.filter((task) => task.rating === "high").length;
  const totalMinutes = tasks.reduce((sum, task) => sum + minutesLabel(task.elapsedSeconds), 0);
  const completionRate = tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0;
  const highRate = rated.length ? Math.round((highCount / rated.length) * 100) : 0;
  const score = rated.length
    ? rated.reduce((sum, task) => sum + RATING_SCORE[task.rating], 0) / rated.length
    : 0;

  elements.doneMetric.textContent = `${completed.length}/${tasks.length}`;
  elements.minutesMetric.textContent = totalMinutes;
  elements.completionMetric.textContent = `${completionRate}%`;
  elements.highMetric.textContent = `${highRate}%`;
  elements.scoreMeter.style.width = `${score ? (score / 3) * 100 : 0}%`;
  elements.scoreLabel.textContent = scoreLabel(score);

  renderDayClock(tasks);
  renderDailyEfficiency(completed);
  renderCategoryBreakdown();
  renderWeekChart();
  renderMonthSummary();
  renderHistory();
}

function renderDayClock(tasks) {
  const displayTasks = tasks.filter((task) => task.date === todayKey());
  const now = new Date();
  elements.clockNow.textContent = formatTime(now);
  elements.clockSummary.textContent = displayTasks.length
    ? `${displayTasks.length} task trên vòng 24h`
    : "Task sẽ xuất hiện ngay khi được tạo.";

  elements.dayClock.innerHTML = buildClockSvg(displayTasks, now);
  renderClockList(displayTasks);
}

function pointOnCircle(cx, cy, radius, minute) {
  const angle = (minute / 1440) * Math.PI * 2 - Math.PI / 2;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function arcPath(cx, cy, radius, startMinute, endMinute) {
  const start = pointOnCircle(cx, cy, radius, startMinute);
  const end = pointOnCircle(cx, cy, radius, Math.min(1439.9, endMinute));
  const largeArc = endMinute - startMinute > 720 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function clockSegment(task, index, cx, cy, radius) {
  const window = taskTimeWindow(task);
  const startMinute = minuteOfDay(window.start);
  let endMinute = minuteOfDay(window.end);
  if (endMinute <= startMinute) {
    endMinute = 1439.9;
  }
  endMinute = Math.max(startMinute + 2, endMinute);
  const color = taskColor(task, index);
  const width = task.status === "complete" ? 13 : task.status === "running" ? 17 : 11;
  const dash = task.status === "idle" ? 'stroke-dasharray="3 5"' : "";
  return `<path class="task-arc ${task.status}" d="${arcPath(cx, cy, radius - (index % 4) * 18, startMinute, endMinute)}" stroke="${color}" stroke-width="${width}" ${dash}><title>${escapeHtml(task.name)} · ${formatTime(window.start)}-${formatTime(window.end)} · ${statusLabel(task)}</title></path>`;
}

function buildClockSvg(tasks, now) {
  const cx = 150;
  const cy = 150;
  const radius = 108;
  const nowPoint = pointOnCircle(cx, cy, radius + 8, minuteOfDay(now));
  const segments = tasks.map((task, index) => clockSegment(task, index, cx, cy, radius)).join("");
  const hourMarks = Array.from({ length: 24 }, (_, hour) => {
    const outer = pointOnCircle(cx, cy, radius + 14, hour * 60);
    const inner = pointOnCircle(cx, cy, radius + (hour % 6 === 0 ? 3 : 8), hour * 60);
    const label = hour % 6 === 0
      ? `<text x="${pointOnCircle(cx, cy, radius + 30, hour * 60).x}" y="${pointOnCircle(cx, cy, radius + 30, hour * 60).y + 4}" text-anchor="middle">${hour}</text>`
      : "";
    return `<line x1="${inner.x}" y1="${inner.y}" x2="${outer.x}" y2="${outer.y}"></line>${label}`;
  }).join("");

  return `
    <svg viewBox="0 0 300 300" role="img" aria-label="Đồng hồ 24 giờ của các task hôm nay">
      <circle class="clock-face" cx="${cx}" cy="${cy}" r="${radius}"></circle>
      <g class="hour-marks">${hourMarks}</g>
      <g>${segments}</g>
      <line class="now-hand" x1="${cx}" y1="${cy}" x2="${nowPoint.x}" y2="${nowPoint.y}"></line>
      <circle class="now-pin" cx="${cx}" cy="${cy}" r="5"></circle>
      <text class="clock-center-time" x="${cx}" y="${cy - 4}" text-anchor="middle">${formatTime(now)}</text>
      <text class="clock-center-label" x="${cx}" y="${cy + 16}" text-anchor="middle">hiện tại</text>
    </svg>
  `;
}

function renderClockList(tasks) {
  elements.dayClockList.innerHTML = "";
  if (!tasks.length) {
    elements.dayClockList.innerHTML = '<div class="muted-note">Chưa có task nào trên đồng hồ hôm nay.</div>';
    return;
  }

  tasks.forEach((task, index) => {
    const window = taskTimeWindow(task);
    const row = document.createElement("div");
    row.className = `clock-task ${task.status}`;
    row.style.setProperty("--task-color", taskColor(task, index));
    row.innerHTML = `
      <span class="clock-swatch"></span>
      <div>
        <strong></strong>
        <span>${formatTime(window.start)}-${formatTime(window.end)} · ${statusLabel(task)} · ${durationVarianceLabel(task)} · ${task.rating ? RATING_LABEL[task.rating] : "Chưa đánh giá"}</span>
      </div>
    `;
    row.querySelector("strong").textContent = task.name;
    elements.dayClockList.append(row);
  });
}

function renderDailyEfficiency(completed) {
  elements.dailyEfficiency.innerHTML = "";
  const rated = completed.filter((task) => task.rating);

  if (!rated.length) {
    elements.dailyEfficiency.innerHTML = '<div class="muted-note">Hoàn thành task rồi chọn mức hiệu quả để thấy biểu đồ.</div>';
    return;
  }

  rated.forEach((task) => {
    const row = document.createElement("div");
    row.className = "eff-row";
    row.innerHTML = `
      <span class="eff-name"></span>
      <span class="eff-pill ${task.rating}">${RATING_LABEL[task.rating]}</span>
    `;
    row.querySelector(".eff-name").textContent = task.name;
    elements.dailyEfficiency.append(row);
  });
}

function renderCategoryBreakdown() {
  elements.categoryBreakdown.innerHTML = "";
  const sourceTasks = todayTasks();
  const categories = analysisCategories().filter((category) => {
    if (ui.selectedCategory !== "all") return category === ui.selectedCategory;
    return sourceTasks.some((task) => taskCategory(task) === category);
  });

  if (!categories.length) {
    elements.categoryBreakdown.innerHTML = '<div class="muted-note">Chưa có loại công việc nào để phân tích.</div>';
    return;
  }

  const maxMinutes = Math.max(
    30,
    ...categories.map((category) => sourceTasks
      .filter((task) => taskCategory(task) === category)
      .reduce((sum, task) => sum + minutesLabel(task.elapsedSeconds), 0)),
  );

  categories.forEach((category) => {
    const tasks = sourceTasks.filter((task) => taskCategory(task) === category);
    const done = tasks.filter((task) => task.status === "complete").length;
    const rated = tasks.filter((task) => task.rating);
    const high = rated.filter((task) => task.rating === "high").length;
    const minutes = tasks.reduce((sum, task) => sum + minutesLabel(task.elapsedSeconds), 0);
    const width = Math.max(4, Math.round((minutes / maxMinutes) * 100));
    const highRate = rated.length ? Math.round((high / rated.length) * 100) : 0;

    const row = document.createElement("div");
    row.className = "category-row";
    row.innerHTML = `
      <div class="category-row-head">
        <strong></strong>
        <span>${done}/${tasks.length} task · ${minutes} phút · ${highRate}% cao</span>
      </div>
      <div class="category-track"><div style="width: ${width}%"></div></div>
    `;
    row.querySelector("strong").textContent = category;
    elements.categoryBreakdown.append(row);
  });
}

function lastSevenDays() {
  const days = [];
  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - index);
    days.push({
      key: todayKey(date),
      label: new Intl.DateTimeFormat("vi-VN", { weekday: "short" }).format(date),
    });
  }
  return days;
}

function renderWeekChart() {
  const days = lastSevenDays();
  const maxMinutes = Math.max(
    30,
    ...days.map((day) => state.data.tasks
      .filter((task) => task.date === day.key && categoryMatches(task))
      .reduce((sum, task) => sum + minutesLabel(task.elapsedSeconds), 0)),
  );

  elements.weekChart.innerHTML = "";
  days.forEach((day) => {
    const dayTasks = state.data.tasks.filter((task) => task.date === day.key && categoryMatches(task));
    const minutes = dayTasks.reduce((sum, task) => sum + minutesLabel(task.elapsedSeconds), 0);
    const done = dayTasks.filter((task) => task.status === "complete").length;
    const height = Math.max(4, Math.round((minutes / maxMinutes) * 100));

    const item = document.createElement("div");
    item.className = "bar-item";
    item.innerHTML = `
      <div class="bar-value">${minutes}p</div>
      <div class="bar-track" title="${done} task xong"><div class="bar-fill" style="height: ${height}%"></div></div>
      <div class="bar-label">${day.label}</div>
    `;
    elements.weekChart.append(item);
  });
}

function renderMonthSummary() {
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthTasks = state.data.tasks.filter((task) => task.date.startsWith(monthPrefix) && categoryMatches(task));
  const activeDays = new Set(monthTasks.filter((task) => task.elapsedSeconds > 0 || task.status === "complete").map((task) => task.date));
  const doneTasks = monthTasks.filter((task) => task.status === "complete").length;
  const minutes = monthTasks.reduce((sum, task) => sum + minutesLabel(task.elapsedSeconds), 0);

  elements.monthActiveDays.textContent = activeDays.size;
  elements.monthDoneTasks.textContent = doneTasks;
  elements.monthMinutes.textContent = minutes;
}

function selectedHistoryWindow() {
  const selectedDate = parseDateKey(elements.historyDate.value || todayKey());
  const range = elements.historyRange.value;

  if (range === "week") {
    const start = addDays(selectedDate, -((selectedDate.getDay() + 6) % 7));
    const end = addDays(start, 6);
    return { start, end, label: `${formatDateShort(start)} - ${formatDateShort(end)}` };
  }

  if (range === "month") {
    const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    return { start, end, label: `Tháng ${String(selectedDate.getMonth() + 1).padStart(2, "0")}/${selectedDate.getFullYear()}` };
  }

  return { start: selectedDate, end: selectedDate, label: formatDateLong(selectedDate) };
}

function renderHistoryTask(task, index) {
  const window = taskTimeWindow(task);
  const item = document.createElement("article");
  item.className = `history-task ${task.status}`;
  item.style.setProperty("--task-color", taskColor(task, index));
  item.innerHTML = `
    <div class="history-date">${formatDateShort(parseDateKey(task.date))}</div>
    <div class="history-body">
      <div class="history-title-row">
        <strong></strong>
        <span>${statusLabel(task)}</span>
      </div>
      <div class="history-meta">
        <span>${formatTime(window.start)}-${formatTime(window.end)}</span>
        <span>${taskCategory(task)}</span>
        <span>${scheduleDriftLabel(task)}</span>
        <span>${durationVarianceLabel(task)}</span>
        <span>${minutesLabel(task.elapsedSeconds)} phút focus</span>
        <span>${task.rating ? RATING_LABEL[task.rating] : "Chưa đánh giá"}</span>
      </div>
    </div>
  `;
  item.querySelector("strong").textContent = task.name;
  return item;
}

function renderHistory() {
  const window = selectedHistoryWindow();
  const startKey = todayKey(window.start);
  const endKey = todayKey(window.end);
  const tasks = state.data.tasks
    .filter((task) => task.date >= startKey && task.date <= endKey && categoryMatches(task))
    .sort((a, b) => taskTimeWindow(a).start.getTime() - taskTimeWindow(b).start.getTime());

  const completed = tasks.filter((task) => task.status === "complete");
  const minutes = tasks.reduce((sum, task) => sum + minutesLabel(task.elapsedSeconds), 0);
  const rated = completed.filter((task) => task.rating);
  const avgScore = rated.length
    ? rated.reduce((sum, task) => sum + RATING_SCORE[task.rating], 0) / rated.length
    : 0;

  elements.historySummary.innerHTML = `
    <strong>${escapeHtml(window.label)}</strong>
    <span>${tasks.length} task · ${completed.length} hoàn thành · ${minutes} phút focus · ${avgScore ? scoreLabel(avgScore) : "Chưa có đánh giá"}</span>
  `;

  elements.historyList.innerHTML = "";
  if (!tasks.length) {
    elements.historyList.innerHTML = '<div class="muted-note">Không có task nào trong khoảng thời gian này.</div>';
    return;
  }

  tasks.forEach((task, index) => elements.historyList.append(renderHistoryTask(task, index)));
}
