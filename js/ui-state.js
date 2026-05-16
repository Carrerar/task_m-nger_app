import { todayKey } from "./time.js";

// Mutable, shared UI state. Modules read and write fields directly.
export const ui = {
  selectedCategory: "all",
  startBlockMessage: "",
  composerOpen: false,
  editingTaskId: null,
  taskBoardDate: todayKey(),
  materializedDay: todayKey(),
};
