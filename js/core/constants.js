export const STORAGE_KEY = "personal_productivity_data_v1";

// Per-second timer tick throttles the localStorage write to this interval.
// Full saves still happen on every state change + visibility/unload.
export const TICK_SAVE_MS = 12000;

// `data.sessions` is append-only telemetry never surfaced in the UI; keep
// only the most recent N so the stored payload can't grow unbounded.
export const SESSION_CAP = 1000;

export const RATING_SCORE = { low: 1, medium: 2, high: 3 };
export const RATING_LABEL = { low: "Thấp", medium: "Trung bình", high: "Cao" };

export const CATEGORY_COLORS = [
  "#1f7a5b",
  "#4169a8",
  "#b06d2b",
  "#8a5aa8",
  "#be4f57",
  "#477a37",
  "#b08a22",
  "#2e7f86",
];

export const RECURRENCE_LABEL = {
  daily: "Hằng ngày",
  weekdays: "Thứ 2 - Thứ 6",
  weekly: "Hằng tuần",
};

export const WEEKDAY_LABEL = [
  "Chủ nhật",
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
];
