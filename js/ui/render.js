import { ui } from "../core/ui-state.js";
import { render } from "../core/bus.js";
import { elements } from "../core/dom.js";
import { RATING_LABEL } from "../core/constants.js";
import { secondsToClock, minutesLabel, formatTime } from "../core/time.js";
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
} from "../core/selectors.js";
import { escapeHtml } from "../core/utils.js";
import { todayKey } from "../core/time.js";
import {
  toggleComplete,
  pauseTask,
  finishTaskEarly,
  startTask,
  resetTask,
  deleteTask,
  setRating,
  updateTask,
} from "../features/tasks.js";
import { startEditTask } from "../features/composer.js";

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

// Quick inline edit of the two most-edited fields (name + planned minutes)
// right on the card. "Sửa chi tiết" still opens the full composer for
// category/date/repeat. Reuses updateTask (keeps the existing schedule).
function renderInlineEditor(task) {
  const wrap = document.createElement("div");
  wrap.className = "task-inline-edit";
  wrap.innerHTML = `
    <input class="ie-name" type="text" aria-label="Tên công việc" autocomplete="off">
    <input class="ie-min" type="number" min="1" max="240" aria-label="Phút dự kiến">
  `;
  const nameInput = wrap.querySelector(".ie-name");
  const minInput = wrap.querySelector(".ie-min");
  nameInput.value = task.name;
  minInput.value = task.plannedMinutes;

  const save = () => {
    const name = nameInput.value.trim();
    const plannedMinutes = Number.parseInt(minInput.value, 10);
    if (!name || !Number.isFinite(plannedMinutes) || plannedMinutes < 1) return;
    ui.inlineEditId = null;
    updateTask(task.id, {
      name,
      plannedMinutes,
      category: task.category,
      scheduledDate: task.date,
      scheduledTime: "",
    });
  };
  const cancel = () => {
    ui.inlineEditId = null;
    render();
  };
  const onKey = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  };
  nameInput.addEventListener("keydown", onKey);
  minInput.addEventListener("keydown", onKey);

  const bar = document.createElement("div");
  bar.className = "ie-actions";
  bar.append(
    actionButton("Lưu", save, true),
    actionButton("Hủy", cancel),
    actionButton("Sửa chi tiết", () => {
      ui.inlineEditId = null;
      startEditTask(task.id);
    }, false, "ie-detail"),
  );
  wrap.append(bar);

  queueMicrotask(() => nameInput.focus());
  return wrap;
}

function renderTask(task) {
  const card = document.createElement("article");
  card.className = `task-card${task.status === "complete" ? " is-complete" : ""}`;
  const editing = ui.inlineEditId === task.id;

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

  let noteEl = null;
  if (task.note) {
    noteEl = document.createElement("div");
    noteEl.className = "task-note";
    noteEl.textContent = task.note;
  }

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
  if (task.status !== "running" && !editing) {
    actions.append(actionButton("Sửa", () => {
      ui.inlineEditId = task.id;
      render();
    }));
  }
  actions.append(actionButton("Xóa task", () => deleteTask(task.id), false, "danger-action"));

  main.append(editing ? renderInlineEditor(task) : titleRow, readout, meta);
  if (noteEl) main.append(noteEl);
  main.append(actions);

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
