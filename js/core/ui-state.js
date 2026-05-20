import { todayKey, monthKey, startOfWeek } from "./time.js";

// Mutable, shared UI state. Modules read and write fields directly.
export const ui = {
  selectedCategory: "all",
  startBlockMessage: "",
  composerOpen: false,
  editingTaskId: null,
  inlineEditId: null,
  taskBoardDate: todayKey(),
  materializedDay: todayKey(),
  calendarMonth: monthKey(),
  calendarView: "month",
  calendarWeekStart: todayKey(startOfWeek()),
  recurringCollapsed: false,
};
