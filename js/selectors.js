import { state } from "./store.js";
import { ui } from "./ui-state.js";
import { CATEGORY_COLORS } from "./constants.js";
import { todayKey, formatTime } from "./time.js";
import { normalizeCategories } from "./utils.js";

export function todayTasks() {
  const key = todayKey();
  return state.data.tasks.filter((task) => task.date === key);
}

export function todayVisibleTasks() {
  return state.data.tasks
    .filter((task) => task.date === ui.taskBoardDate && !task.archived)
    .sort((a, b) => taskAddedTimestamp(b) - taskAddedTimestamp(a));
}

export function taskAddedTimestamp(task) {
  const idTime = Number.parseInt(String(task.id).split("-")[0], 10);
  if (Number.isFinite(idTime)) return idTime;
  return new Date(task.createdAt || task.scheduledStartAt || 0).getTime();
}

export function taskCategory(task) {
  return task.category?.trim() || "Chưa phân loại";
}

export function categoryMatches(task) {
  return ui.selectedCategory === "all" || taskCategory(task) === ui.selectedCategory;
}

export function knownCategories() {
  return normalizeCategories([
    ...(Array.isArray(state.data.categories) ? state.data.categories : []),
    ...state.data.tasks.map((task) => task.category || ""),
  ]);
}

export function analysisCategories() {
  const categories = knownCategories();
  const hasUncategorizedTasks = state.data.tasks.some((task) => !task.category?.trim());
  return hasUncategorizedTasks ? [...categories, "Chưa phân loại"] : categories;
}

export function activeTask() {
  return state.data.tasks.find((task) => task.status === "running");
}

export function lockedTask() {
  return state.data.tasks.find((task) => (task.firstStartedAt || task.status === "running" || task.status === "paused") && task.status !== "complete");
}

export function ensureSingleTimer(taskId) {
  const locked = lockedTask();
  return !locked || locked.id === taskId;
}

export function canStartTask(task) {
  const blocker = lockedTask();
  return task.date === todayKey() && (!blocker || blocker.id === task.id);
}

export function statusLabel(task) {
  if (task.status === "running") return "Đang làm";
  if (task.status === "paused") return "Tạm dừng";
  if (task.status === "complete") return "Hoàn thành";
  return "Chưa làm";
}

export function urgencyClass(task) {
  if (task.status === "complete") return "is-done";
  const totalSeconds = task.plannedMinutes * 60;
  if (!totalSeconds) return "is-safe";
  const remainingRatio = task.remainingSeconds / totalSeconds;
  if (remainingRatio <= 0.2) return "is-danger";
  if (remainingRatio <= 0.5) return "is-warning";
  return "is-safe";
}

export function durationVarianceLabel(task) {
  if (task.status !== "complete") return "Chưa chốt thời lượng";
  const plannedSeconds = task.plannedMinutes * 60;
  const diffSeconds = plannedSeconds - task.elapsedSeconds;
  const diffMinutes = Math.abs(Math.round(diffSeconds / 60));
  if (diffMinutes === 0) return "Đúng thời lượng";
  if (diffSeconds > 0) return `Hoàn thành sớm ${diffMinutes} phút`;
  return `Vượt dự kiến ${diffMinutes} phút`;
}

export function taskTimeWindow(task) {
  const start = new Date(task.firstStartedAt || task.scheduledStartAt || task.createdAt || Date.now());
  let end;
  if (task.status === "complete" && (task.endedAt || task.completedAt)) {
    end = new Date(task.endedAt || task.completedAt);
  } else if (!task.firstStartedAt && task.scheduledEndAt) {
    end = new Date(task.scheduledEndAt);
  } else {
    end = new Date(start.getTime() + task.plannedMinutes * 60 * 1000);
  }
  if (end <= start) {
    end = new Date(start.getTime() + 2 * 60 * 1000);
  }
  return { start, end };
}

export function scheduledWindow(task) {
  const start = new Date(task.scheduledStartAt || task.createdAt || Date.now());
  const end = new Date(task.scheduledEndAt || start.getTime() + task.plannedMinutes * 60 * 1000);
  return { start, end };
}

export function actualWindowLabel(task) {
  if (!task.firstStartedAt) return "Chưa bắt đầu";
  const window = taskTimeWindow(task);
  return `${formatTime(window.start)}-${formatTime(window.end)}`;
}

export function scheduleDriftLabel(task) {
  if (!task.firstStartedAt || !task.scheduledStartAt) return "Theo lịch dự kiến";
  const driftMinutes = Math.round((new Date(task.firstStartedAt).getTime() - new Date(task.scheduledStartAt).getTime()) / 60000);
  if (driftMinutes > 0) return `Bắt đầu trễ ${driftMinutes} phút`;
  if (driftMinutes < 0) return `Bắt đầu sớm ${Math.abs(driftMinutes)} phút`;
  return "Đúng giờ";
}

export function taskColor(task, index) {
  const categories = analysisCategories();
  const categoryIndex = Math.max(0, categories.indexOf(taskCategory(task)));
  if (task.status === "complete" && task.rating === "low") return "#d95b59";
  if (task.status === "complete" && task.rating === "medium") return "#c58a2a";
  if (task.status === "complete" && task.rating === "high") return "#27845f";
  return CATEGORY_COLORS[(categoryIndex + index) % CATEGORY_COLORS.length];
}

export function scoreLabel(score) {
  if (!score) return "Chưa có dữ liệu";
  if (score < 1.67) return `Thấp (${score.toFixed(1)}/3)`;
  if (score < 2.34) return `Trung bình (${score.toFixed(1)}/3)`;
  return `Cao (${score.toFixed(1)}/3)`;
}
