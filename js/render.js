import { ui } from "./ui-state.js";
import { elements } from "./dom.js";
import { RATING_LABEL } from "./constants.js";
import { secondsToClock, minutesLabel, formatTime } from "./time.js";
import {
  todayVisibleTasks,
  activeTask,
  lockedTask,
  taskCategory,
  statusLabel,
  urgencyClass,
  durationVarianceLabel,
  scheduledWindow,
  actualWindowLabel,
  scheduleDriftLabel,
  canStartTask,
} from "./selectors.js";
import { escapeHtml } from "./utils.js";
import { todayKey } from "./time.js";
import {
  toggleComplete,
  pauseTask,
  finishTaskEarly,
  startTask,
  resetTask,
  deleteTask,
  setRating,
} from "./tasks.js";
import { startEditTask } from "./composer.js";

function actionButton(label, handler, primary = false, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = `${primary ? "primary-action" : ""} ${className}`.trim();
  button.addEventListener("click", handler);
  return button;
}

function renderRatingBox(task) {
  const box = document.createElement("div");
  box.className = "rating-box";
  box.innerHTML = "<span>Đánh giá mức độ hiệu quả sau khi xong</span>";

  const options = document.createElement("div");
  options.className = "rating-options";

  Object.entries(RATING_LABEL).forEach(([value, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.rating = value;
    button.textContent = label;
    button.className = task.rating === value ? "is-selected" : "";
    button.addEventListener("click", () => setRating(task.id, value));
    options.append(button);
  });

  box.append(options);
  return box;
}

function renderTask(task) {
  const card = document.createElement("article");
  card.className = `task-card${task.status === "complete" ? " is-complete" : ""}`;

  const check = document.createElement("button");
  check.type = "button";
  check.className = `check-button${task.status === "complete" ? " is-checked" : ""}`;
  check.textContent = "✓";
  check.title = task.status === "complete" ? "Bỏ hoàn thành" : "Đánh dấu hoàn thành";
  check.addEventListener("click", () => toggleComplete(task.id));
  card.append(check);

  const main = document.createElement("div");
  main.className = "task-main";

  const titleRow = document.createElement("div");
  titleRow.className = "task-title-row";
  titleRow.innerHTML = `
    <div class="task-title"></div>
    <div class="status-badge">${statusLabel(task)}</div>
  `;
  titleRow.querySelector(".task-title").textContent = task.name;

  const readout = document.createElement("div");
  readout.className = `timer-readout ${urgencyClass(task)}`;
  const progress = task.plannedMinutes > 0 ? Math.min(100, (task.elapsedSeconds / (task.plannedMinutes * 60)) * 100) : 0;
  readout.innerHTML = `
    <div class="time">${secondsToClock(task.remainingSeconds)}</div>
    <div class="progress" aria-label="Tiến độ timer"><div style="width: ${progress}%"></div></div>
  `;

  const meta = document.createElement("div");
  meta.className = "task-meta";
  meta.innerHTML = `
    <span>Loại: ${escapeHtml(taskCategory(task))}</span>
    <span>Lịch: ${formatTime(scheduledWindow(task).start)}-${formatTime(scheduledWindow(task).end)}</span>
    <span>Thực tế: ${actualWindowLabel(task)}</span>
    <span>${scheduleDriftLabel(task)}</span>
    <span>Dự kiến ${task.plannedMinutes} phút</span>
    <span>Đã focus ${minutesLabel(task.elapsedSeconds)} phút</span>
    <span>${durationVarianceLabel(task)}</span>
    <span>${task.rating ? `Hiệu quả: ${RATING_LABEL[task.rating]}` : "Chưa đánh giá"}</span>
  `;

  const actions = document.createElement("div");
  actions.className = "task-actions";

  if (task.status === "running") {
    actions.append(actionButton("Tạm dừng", () => pauseTask(task.id)));
    actions.append(actionButton("Kết thúc sớm", () => finishTaskEarly(task.id), false, "finish-early-action"));
  } else if (task.status !== "complete") {
    const startButton = actionButton(task.status === "paused" ? "Tiếp tục" : "Bắt đầu", () => startTask(task.id), true);
    startButton.disabled = !canStartTask(task);
    if (startButton.disabled) {
      startButton.title = task.date !== todayKey()
        ? "Task này được lên lịch cho ngày khác"
        : "Hoàn thành task đang làm trước khi bắt đầu task khác";
    }
    actions.append(startButton);
    if (task.status === "paused") {
      actions.append(actionButton("Kết thúc sớm", () => finishTaskEarly(task.id), false, "finish-early-action"));
    }
  }

  if (task.status !== "complete") {
    actions.append(actionButton("Reset", () => resetTask(task.id)));
  }
  if (task.status !== "running") {
    actions.append(actionButton("Sửa", () => startEditTask(task.id)));
  }
  actions.append(actionButton("Xóa task", () => deleteTask(task.id), false, "danger-action"));

  main.append(titleRow, readout, meta, actions);

  if (task.status === "complete") {
    main.append(renderRatingBox(task));
  }

  card.append(main);
  return card;
}

export function renderTasks() {
  const tasks = todayVisibleTasks();
  elements.taskList.innerHTML = "";
  tasks.forEach((task) => elements.taskList.append(renderTask(task)));
  elements.emptyState.style.display = tasks.length ? "none" : "block";
}

function lockStatusText() {
  const locked = lockedTask();
  if (!locked) return "Chưa có timer nào đang chạy";
  return `Đang khóa luồng: hoàn thành "${locked.name}" trước khi làm task khác`;
}

export function renderActiveFocus() {
  const running = activeTask();
  elements.activeFocus.classList.toggle("is-running", Boolean(running));
  elements.activeFocus.classList.toggle("is-blocked", Boolean(ui.startBlockMessage));
  elements.activeFocusText.textContent = ui.startBlockMessage || (running
    ? `Đang focus: ${running.name} còn ${secondsToClock(running.remainingSeconds)}`
    : lockStatusText());
}
